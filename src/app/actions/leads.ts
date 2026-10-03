"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { courses, curriculumRequests } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { loginBlockedFor, recordLoginFailure } from "@/lib/rate-limit";
import { publicCurriculum } from "@/lib/curriculum";
import { LEAD_BACKGROUNDS } from "@/lib/leads";
import { absoluteUrl } from "@/lib/site";
import { firstName } from "@/lib/utils";
import { dialCode, email, firstError, formatPhone, formValues, phoneNumber, required } from "@/lib/validation";

export type CurriculumRequestState = { error?: string; done?: true; url?: string | null } | undefined;

const requestSchema = z.object({
  name: required("Your name", 120),
  email,
  dialCode,
  phone: phoneNumber,
});

/**
 * Saves the visitor's details (a marketing lead) and unlocks the curriculum: the uploaded document when there
 * is one, otherwise the module outline shown in the modal. Either way a copy goes to their inbox.
 */
export async function requestCurriculum(courseId: number, _state: CurriculumRequestState, formData: FormData): Promise<CurriculumRequestState> {
  const parsed = requestSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, email: address } = parsed.data;
  // Bots fill the hidden field; pretend it worked.
  if (String(formData.get("website") ?? "")) return { done: true, url: null };

  const db = await getDb();
  const [course] = await db.select().from(courses).where(and(eq(courses.id, courseId), eq(courses.published, true)));
  if (!course) return { error: "This course isn't available." };
  if (!course.curriculumUrl && !(await publicCurriculum(course.id, course.curriculum)).length) return { error: "The curriculum for this course isn't available yet." };

  const wait = await loginBlockedFor(address, "curriculum");
  if (wait) return { error: `Too many requests. Please try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  await recordLoginFailure(address, "curriculum");

  const background = String(formData.get("background") ?? "");
  await db.insert(curriculumRequests).values({
    courseId: course.id,
    courseTitle: course.title,
    name,
    email: address,
    phone: formatPhone(parsed.data.dialCode, parsed.data.phone),
    background: (LEAD_BACKGROUNDS as readonly string[]).includes(background) ? background : "",
    marketingOptIn: formData.get("marketing") === "on",
    source: String(formData.get("source") ?? "").trim().slice(0, 200),
  });

  const courseUrl = absoluteUrl(`/courses/${course.slug}`);
  await sendEmail(address, "curriculum_request", { name: firstName(name), courseTitle: course.title, curriculumUrl: course.curriculumUrl ? absoluteUrl(course.curriculumUrl) : `${courseUrl}#curriculum`, courseUrl });
  return { done: true, url: course.curriculumUrl };
}
