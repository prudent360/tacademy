"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { courses, curriculumRequests } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { loginBlockedFor, recordLoginFailure } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/site";
import { firstName } from "@/lib/utils";
import { dialCode, email, firstError, formatPhone, formValues, phoneNumber, required } from "@/lib/validation";

export type CurriculumRequestState = { error?: string; url?: string } | undefined;

const requestSchema = z.object({
  name: required("Your name", 120),
  email,
  dialCode,
  phone: phoneNumber,
});

/** Saves the visitor's details and hands back the course's curriculum document. */
export async function requestCurriculum(courseId: number, _state: CurriculumRequestState, formData: FormData): Promise<CurriculumRequestState> {
  const parsed = requestSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, email: address } = parsed.data;

  const db = await getDb();
  const [course] = await db.select().from(courses).where(and(eq(courses.id, courseId), eq(courses.published, true)));
  if (!course?.curriculumUrl) return { error: "The curriculum for this course isn't available yet." };

  const wait = await loginBlockedFor(address, "curriculum");
  if (wait) return { error: `Too many requests. Please try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  await recordLoginFailure(address, "curriculum");

  const phone = formatPhone(parsed.data.dialCode, parsed.data.phone);
  await db.insert(curriculumRequests).values({ courseId: course.id, courseTitle: course.title, name, email: address, phone });

  const curriculumUrl = absoluteUrl(course.curriculumUrl);
  await sendEmail(address, "curriculum_request", { name: firstName(name), courseTitle: course.title, curriculumUrl, courseUrl: absoluteUrl(`/courses/${course.slug}`) });
  return { url: course.curriculumUrl };
}
