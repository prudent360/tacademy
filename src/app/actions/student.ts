"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { assignments, submissions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCohortWithCourse, getInstructorsByCohort, isEnrolled } from "@/lib/data";
import { notify } from "@/lib/notify";
import { absoluteUrl } from "@/lib/site";
import { deleteIfReplaced } from "@/lib/storage";
import { resolveFileField, uploadErrorMessage } from "@/lib/upload-field";
import { optionalUrl, type FormState } from "@/lib/validation";

export async function submitAssignment(assignmentId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const db = await getDb();
  const [assignment] = await db.select().from(assignments).where(and(eq(assignments.id, assignmentId), eq(assignments.published, true)));
  if (!assignment || !(await isEnrolled(user.id, assignment.cohortId))) return { error: "This assignment isn't available." };

  const [existing] = await db.select().from(submissions).where(and(eq(submissions.assignmentId, assignmentId), eq(submissions.userId, user.id)));
  if (existing?.status === "graded") return { error: "This work has already been graded." };

  const body = String(formData.get("body") ?? "").trim().slice(0, 20_000);
  const link = String(formData.get("linkUrl") ?? "").trim();
  if (!optionalUrl.safeParse(link).success) return { error: "Links must start with http:// or https://" };

  let fileUrl: string | null;
  const file = formData.get("file");
  try {
    fileUrl = await resolveFileField(formData, { file: "file", remove: "removeFile", current: existing?.fileUrl ?? null, folder: "submissions", kind: "document" });
  } catch (error) {
    const message = uploadErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }
  const fileName = file instanceof File && file.size > 0 ? file.name.slice(0, 200) : fileUrl ? existing?.fileName ?? null : null;
  if (!body && !link && !fileUrl) return { error: "Add a written answer, a file or a link before submitting." };

  const values = { body, linkUrl: link || null, fileUrl, fileName, status: "submitted" as const, submittedAt: new Date() };
  let submissionId: number;
  if (existing) {
    await db.update(submissions).set(values).where(eq(submissions.id, existing.id));
    await deleteIfReplaced(existing.fileUrl, fileUrl);
    submissionId = existing.id;
  } else {
    const [row] = await db.insert(submissions).values({ ...values, assignmentId, userId: user.id }).returning({ id: submissions.id });
    submissionId = row.id;
  }

  const found = await getCohortWithCourse(assignment.cohortId);
  const instructors = (await getInstructorsByCohort([assignment.cohortId])).get(assignment.cohortId) ?? [];
  await notify(instructors.map((i) => i.id), {
    kind: "submission",
    title: `${user.name} submitted ${assignment.title}`,
    href: `/teach/submissions/${submissionId}`,
    email: {
      template: "submission_received",
      vars: { studentName: user.name, assignmentTitle: assignment.title, courseTitle: found?.course.title ?? "", gradeUrl: absoluteUrl(`/teach/submissions/${submissionId}`) },
    },
  });

  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  return { ok: existing ? "Your updated work has been submitted." : "Submitted! Your instructor has been notified." };
}
