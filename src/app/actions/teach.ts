"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { announcements, assignments, attendance, ATTENDANCE_STATUSES, classSessions, cohorts, courseModules, enrollments, lessons, SESSION_MODES, submissions, type AttendanceStatus } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";
import { getCohortWithCourse, getSettings } from "@/lib/data";
import { notify } from "@/lib/notify";
import { absoluteUrl } from "@/lib/site";
import { deleteIfReplaced, deleteUpload } from "@/lib/storage";
import { formatDateTime, formatSessionRange, fromZonedInput } from "@/lib/time";
import { resolveFileField, uploadErrorMessage } from "@/lib/upload-field";
import { MODE_LABEL } from "@/lib/utils";
import { dateTimeValue, firstError, formValues, optionalDateTime, optionalUrl, required, text, type FormState } from "@/lib/validation";

async function activeStudents(cohortId: number): Promise<number[]> {
  const rows = await (await getDb()).select({ id: enrollments.userId }).from(enrollments).where(and(eq(enrollments.cohortId, cohortId), eq(enrollments.status, "active")));
  return rows.map((r) => r.id);
}

function refresh(cohortId: number) {
  revalidatePath(`/teach/cohorts/${cohortId}`);
  revalidatePath(`/dashboard/cohorts/${cohortId}`);
}

// ---------- Classes ----------

const sessionSchema = z
  .object({
    title: required("Title", 160),
    description: text(1000),
    mode: z.enum(SESSION_MODES),
    startsAt: dateTimeValue,
    durationMinutes: z.coerce.number().int().min(15, "Classes must be at least 15 minutes.").max(12 * 60, "Classes can be at most 12 hours."),
    meetingUrl: optionalUrl,
    venue: text(300),
    recordingUrl: optionalUrl,
  })
  .refine((v) => v.mode !== "physical" || v.venue.length > 0, "Add the venue for an in-person class.");

function parseSession(formData: FormData, timeZone: string) {
  // Fields that don't apply to the chosen format are not rendered, so default them.
  const parsed = sessionSchema.safeParse({ description: "", meetingUrl: "", venue: "", recordingUrl: "", ...formValues(formData) });
  if (!parsed.success) return { error: firstError(parsed.error) } as const;
  const { startsAt, durationMinutes, meetingUrl, recordingUrl, ...rest } = parsed.data;
  const start = fromZonedInput(startsAt, timeZone);
  return {
    data: {
      ...rest,
      startsAt: start,
      endsAt: new Date(start.getTime() + durationMinutes * 60_000),
      meetingUrl: rest.mode === "virtual" ? meetingUrl || null : null,
      venue: rest.mode === "physical" ? rest.venue : "",
      recordingUrl: recordingUrl || null,
    },
  } as const;
}

export async function createSessions(cohortId: number, _state: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher(cohortId);
  const settings = await getSettings();
  const result = parseSession(formData, settings.timezone);
  if ("error" in result) return { error: result.error };
  const repeat = Math.min(Math.max(Number(formData.get("repeatWeeks") ?? 1) || 1, 1), 24);
  const numbered = repeat > 1 && formData.get("numberTitles") === "on";
  const rows = Array.from({ length: repeat }, (_, i) => ({
    ...result.data,
    cohortId,
    title: numbered ? `${result.data.title} ${i + 1}` : result.data.title,
    startsAt: new Date(result.data.startsAt.getTime() + i * 7 * 86_400_000),
    endsAt: new Date(result.data.endsAt.getTime() + i * 7 * 86_400_000),
  }));
  await (await getDb()).insert(classSessions).values(rows);
  refresh(cohortId);
  return { ok: repeat > 1 ? `${repeat} weekly classes added.` : "Class added." };
}

export async function updateSession(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const [existing] = await db.select().from(classSessions).where(eq(classSessions.id, id));
  if (!existing) return { error: "This class no longer exists." };
  await requireTeacher(existing.cohortId);
  const settings = await getSettings();
  const result = parseSession(formData, settings.timezone);
  if ("error" in result) return { error: result.error };
  const cancelled = formData.get("cancelled") === "on";
  const next = { ...result.data, cancelled };

  const timeChanged = +existing.startsAt !== +next.startsAt || +existing.endsAt !== +next.endsAt;
  const placeChanged = existing.mode !== next.mode || existing.venue !== next.venue || existing.meetingUrl !== next.meetingUrl;
  await db.update(classSessions).set({
    ...next,
    // A new time means the reminders should go out again.
    ...(timeChanged ? { reminderDaySentAt: null, reminderHourSentAt: null } : {}),
  }).where(eq(classSessions.id, id));

  if (formData.get("notifyStudents") === "on" && (timeChanged || placeChanged || cancelled !== existing.cancelled)) {
    const found = await getCohortWithCourse(existing.cohortId);
    const when = formatSessionRange(next.startsAt, next.endsAt, settings.timezone);
    const change = cancelled && !existing.cancelled
      ? `This class on ${formatSessionRange(existing.startsAt, existing.endsAt, settings.timezone)} has been **cancelled**.`
      : [
          timeChanged && `It now takes place **${when}**.`,
          placeChanged && (next.mode === "virtual" ? `It will be **live online**${next.meetingUrl ? `: ${next.meetingUrl}` : ""}.` : `It will be **in person** at ${next.venue}.`),
        ].filter(Boolean).join(" ");
    await notify(await activeStudents(existing.cohortId), {
      kind: "session",
      title: cancelled ? `Cancelled: ${next.title}` : `Updated: ${next.title}`,
      body: cancelled ? "This class has been cancelled." : `${when} · ${MODE_LABEL[next.mode]}`,
      href: `/dashboard/cohorts/${existing.cohortId}`,
      email: { template: "session_updated", vars: { sessionTitle: next.title, courseTitle: found?.course.title ?? "", change, sessionUrl: absoluteUrl(`/dashboard/cohorts/${existing.cohortId}`) } },
    });
  }
  refresh(existing.cohortId);
  return { ok: "Class saved." };
}

export async function deleteSession(id: number): Promise<void> {
  const db = await getDb();
  const [existing] = await db.select().from(classSessions).where(eq(classSessions.id, id));
  if (!existing) return;
  await requireTeacher(existing.cohortId);
  await db.delete(classSessions).where(eq(classSessions.id, id));
  refresh(existing.cohortId);
  redirect(`/teach/cohorts/${existing.cohortId}?tab=classes`);
}

export async function saveAttendance(sessionId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const [session] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId));
  if (!session) return { error: "This class no longer exists." };
  await requireTeacher(session.cohortId);
  const students = await activeStudents(session.cohortId);
  const marks: { sessionId: number; userId: number; status: AttendanceStatus }[] = [];
  for (const userId of students) {
    const value = String(formData.get(`status-${userId}`) ?? "");
    if ((ATTENDANCE_STATUSES as readonly string[]).includes(value)) marks.push({ sessionId, userId, status: value as AttendanceStatus });
  }
  await db.delete(attendance).where(eq(attendance.sessionId, sessionId));
  if (marks.length) await db.insert(attendance).values(marks);
  refresh(session.cohortId);
  return { ok: `Attendance saved for ${marks.length} ${marks.length === 1 ? "student" : "students"}.` };
}

// ---------- Assignments ----------

const assignmentSchema = z.object({
  title: required("Title", 160),
  instructions: text(20_000),
  dueAt: optionalDateTime,
  maxScore: z.coerce.number().int().min(1, "Max score must be at least 1.").max(1000),
  lessonId: z.string().trim().refine((value) => value === "" || /^\d+$/.test(value), "Choose a valid lesson."),
});

async function linkedLesson(cohortId: number, raw: string): Promise<number | null | undefined> {
  if (!raw) return null;
  const lessonId = Number(raw);
  const [valid] = await (await getDb()).select({ id: lessons.id }).from(cohorts).innerJoin(courseModules, eq(courseModules.courseId, cohorts.courseId)).innerJoin(lessons, eq(lessons.moduleId, courseModules.id)).where(and(eq(cohorts.id, cohortId), eq(lessons.id, lessonId)));
  return valid?.id;
}

async function announceAssignment(assignmentId: number, cohortId: number, title: string, dueAt: Date | null) {
  const settings = await getSettings();
  const found = await getCohortWithCourse(cohortId);
  const dueDate = dueAt ? formatDateTime(dueAt, settings.timezone) : "No deadline";
  await notify(await activeStudents(cohortId), {
    kind: "assignment",
    title: `New assignment: ${title}`,
    body: dueAt ? `Due ${dueDate}` : "",
    href: `/dashboard/assignments/${assignmentId}`,
    email: { template: "assignment_published", vars: { assignmentTitle: title, courseTitle: found?.course.title ?? "", dueDate, assignmentUrl: absoluteUrl(`/dashboard/assignments/${assignmentId}`) } },
  });
}

async function attachmentField(formData: FormData, current: string | null): Promise<{ url: string | null } | { error: string }> {
  try {
    return { url: await resolveFileField(formData, { file: "attachment", remove: "removeAttachment", current, folder: "assignments", kind: "document" }) };
  } catch (error) {
    const message = uploadErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }
}

export async function createAssignment(cohortId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireTeacher(cohortId);
  const parsed = assignmentSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const lessonId = await linkedLesson(cohortId, parsed.data.lessonId);
  if (lessonId === undefined) return { error: "That lesson does not belong to this cohort's course." };
  const settings = await getSettings();
  const attachment = await attachmentField(formData, null);
  if ("error" in attachment) return attachment;
  const dueAt = parsed.data.dueAt ? fromZonedInput(parsed.data.dueAt, settings.timezone) : null;
  const published = formData.get("published") === "on";
  const [row] = await (await getDb())
    .insert(assignments)
    .values({ ...parsed.data, lessonId, dueAt, cohortId, published, attachmentUrl: attachment.url, createdById: user.id })
    .returning({ id: assignments.id });
  if (published) await announceAssignment(row.id, cohortId, parsed.data.title, dueAt);
  refresh(cohortId);
  redirect(`/teach/assignments/${row.id}?created=1`);
}

export async function updateAssignment(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const [existing] = await db.select().from(assignments).where(eq(assignments.id, id));
  if (!existing) return { error: "This assignment no longer exists." };
  await requireTeacher(existing.cohortId);
  const parsed = assignmentSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const lessonId = await linkedLesson(existing.cohortId, parsed.data.lessonId);
  if (lessonId === undefined) return { error: "That lesson does not belong to this cohort's course." };
  const settings = await getSettings();
  const attachment = await attachmentField(formData, existing.attachmentUrl);
  if ("error" in attachment) return attachment;
  const dueAt = parsed.data.dueAt ? fromZonedInput(parsed.data.dueAt, settings.timezone) : null;
  const published = formData.get("published") === "on";
  const dueChanged = (existing.dueAt?.getTime() ?? null) !== (dueAt?.getTime() ?? null);
  await db.update(assignments).set({
    ...parsed.data, lessonId, dueAt, published, attachmentUrl: attachment.url,
    ...(dueChanged ? { reminderSentAt: null } : {}),
  }).where(eq(assignments.id, id));
  await deleteIfReplaced(existing.attachmentUrl, attachment.url);
  if (published && !existing.published) await announceAssignment(id, existing.cohortId, parsed.data.title, dueAt);
  refresh(existing.cohortId);
  revalidatePath(`/teach/assignments/${id}`);
  return { ok: published && !existing.published ? "Published. Students have been notified." : "Assignment saved." };
}

export async function deleteAssignment(id: number): Promise<void> {
  const db = await getDb();
  const [existing] = await db.select().from(assignments).where(eq(assignments.id, id));
  if (!existing) return;
  await requireTeacher(existing.cohortId);
  const files = await db.select({ url: submissions.fileUrl }).from(submissions).where(eq(submissions.assignmentId, id));
  await db.delete(assignments).where(eq(assignments.id, id));
  await deleteUpload(existing.attachmentUrl);
  for (const f of files) await deleteUpload(f.url);
  refresh(existing.cohortId);
  redirect(`/teach/cohorts/${existing.cohortId}?tab=assignments`);
}

export async function gradeSubmission(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const [row] = await db.select({ submission: submissions, assignment: assignments }).from(submissions).innerJoin(assignments, eq(assignments.id, submissions.assignmentId)).where(eq(submissions.id, id));
  if (!row) return { error: "This submission no longer exists." };
  const user = await requireTeacher(row.assignment.cohortId);
  const decision = formData.get("decision") === "resubmit" ? "resubmit" : "graded";
  const feedback = String(formData.get("feedback") ?? "").trim().slice(0, 20_000);
  const rawScore = String(formData.get("score") ?? "").trim();
  let score: number | null = null;
  if (rawScore) {
    score = Number(rawScore);
    if (!Number.isInteger(score) || score < 0 || score > row.assignment.maxScore) return { error: `Score must be a whole number from 0 to ${row.assignment.maxScore}.` };
  }
  if (decision === "graded" && score === null) return { error: "Enter a score, or choose \"Request changes\"." };
  if (decision === "resubmit" && !feedback) return { error: "Explain what needs to change so the student can resubmit." };

  await db.update(submissions).set({ status: decision, score: decision === "graded" ? score : null, feedback, gradedById: user.id, gradedAt: new Date() }).where(eq(submissions.id, id));

  const result = decision === "graded" ? `You scored ${score} / ${row.assignment.maxScore}.` : "They've asked for some changes before grading.";
  await notify([row.submission.userId], {
    kind: "feedback",
    title: decision === "graded" ? `Feedback on ${row.assignment.title}: ${score}/${row.assignment.maxScore}` : `Changes requested on ${row.assignment.title}`,
    href: `/dashboard/assignments/${row.assignment.id}`,
    email: { template: "feedback_posted", vars: { assignmentTitle: row.assignment.title, result, assignmentUrl: absoluteUrl(`/dashboard/assignments/${row.assignment.id}`) } },
  });
  revalidatePath(`/teach/assignments/${row.assignment.id}`);
  revalidatePath(`/teach/submissions/${id}`);
  return { ok: decision === "graded" ? "Grade saved and the student has been notified." : "Sent back to the student with your notes." };
}

// ---------- Announcements ----------

const announcementSchema = z.object({ title: required("Title", 160), body: text(10_000) });

export async function postAnnouncement(cohortId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireTeacher(cohortId);
  const parsed = announcementSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await (await getDb()).insert(announcements).values({ ...parsed.data, cohortId, authorId: user.id });
  const found = await getCohortWithCourse(cohortId);
  const sendEmail = formData.get("email") === "on";
  await notify(await activeStudents(cohortId), {
    kind: "announcement",
    title: parsed.data.title,
    body: `${found?.course.title ?? ""} · from ${user.name}`,
    href: `/dashboard/cohorts/${cohortId}`,
    email: sendEmail
      ? { template: "announcement", vars: { title: parsed.data.title, message: parsed.data.body, courseTitle: found?.course.title ?? "", cohortUrl: absoluteUrl(`/dashboard/cohorts/${cohortId}`) } }
      : undefined,
  });
  refresh(cohortId);
  return { ok: sendEmail ? "Posted and emailed to the cohort." : "Posted to the cohort." };
}

export async function deleteAnnouncement(id: number): Promise<void> {
  const db = await getDb();
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id));
  if (!row) return;
  await requireTeacher(row.cohortId);
  await db.delete(announcements).where(eq(announcements.id, id));
  refresh(row.cohortId);
}

/** Marks enrolments in a cohort as completed (end of course). */
export async function completeCohort(cohortId: number): Promise<void> {
  await requireTeacher(cohortId);
  await (await getDb()).update(enrollments).set({ status: "completed" }).where(and(eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["active"])));
  refresh(cohortId);
}
