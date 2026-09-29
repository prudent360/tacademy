"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { cohorts, courseModules, courses, enrollments, lessonProgress, lessons, moduleReleases, quizzes } from "@/db/schema";
import { requireCourseEditor, requireRole, requireTeacher, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { quizStatus } from "@/lib/quiz";
import { fromZonedInput } from "@/lib/time";
import { firstError, formValues, optionalUrl, required, sortValue, text, type FormState } from "@/lib/validation";

const moduleSchema = z.object({
  title: required("Module title", 160),
  summary: text(500),
  position: sortValue,
});

const lessonSchema = z.object({
  title: required("Lesson title", 160),
  summary: text(500),
  content: text(100_000),
  videoUrl: optionalUrl,
  resourceUrl: optionalUrl,
  resourceLabel: text(120),
  estimatedMinutes: z.coerce.number().int().min(1, "Estimated time must be at least one minute.").max(600),
  position: sortValue,
});

function refreshCourseLearning(courseId: number) {
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/teach", "layout");
  revalidatePath("/dashboard", "layout");
}

/** Where instructors return to after saving: the Learning tab of the cohort they came from. */
function teachReturn(formData: FormData): string {
  const cohortId = Number(formData.get("cohort"));
  return Number.isInteger(cohortId) && cohortId > 0 ? `/teach/cohorts/${cohortId}?tab=learning` : "/teach";
}

export async function createModule(courseId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCourseEditor(courseId);
  const parsed = moduleSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId));
  if (!course) return { error: "This course no longer exists." };
  const [module] = await db.insert(courseModules).values({ ...parsed.data, courseId, published: formData.get("published") === "on" }).returning({ id: courseModules.id });
  refreshCourseLearning(courseId);
  redirect(user.role === "admin" ? `/admin/modules/${module.id}?created=1` : teachReturn(formData));
}

export async function updateModule(moduleId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const [existing] = await db.select({ courseId: courseModules.courseId }).from(courseModules).where(eq(courseModules.id, moduleId));
  if (!existing) return { error: "This module no longer exists." };
  await requireCourseEditor(existing.courseId);
  const parsed = moduleSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const [row] = await db.update(courseModules).set({ ...parsed.data, published: formData.get("published") === "on", updatedAt: new Date() }).where(eq(courseModules.id, moduleId)).returning({ courseId: courseModules.courseId });
  if (!row) return { error: "This module no longer exists." };
  refreshCourseLearning(row.courseId);
  return { ok: "Module saved." };
}

/** Quick publish/unpublish from an instructor's Learning tab. */
export async function setModulePublished(moduleId: number, published: boolean): Promise<void> {
  const db = await getDb();
  const [existing] = await db.select({ courseId: courseModules.courseId }).from(courseModules).where(eq(courseModules.id, moduleId));
  if (!existing) return;
  await requireCourseEditor(existing.courseId);
  await db.update(courseModules).set({ published, updatedAt: new Date() }).where(eq(courseModules.id, moduleId));
  refreshCourseLearning(existing.courseId);
}

export async function deleteModule(moduleId: number): Promise<void> {
  await requireRole("admin");
  const [row] = await (await getDb()).delete(courseModules).where(eq(courseModules.id, moduleId)).returning({ courseId: courseModules.courseId });
  if (!row) redirect("/admin/courses");
  refreshCourseLearning(row.courseId);
  redirect(`/admin/courses/${row.courseId}`);
}

export async function createLesson(moduleId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const [module] = await db.select({ courseId: courseModules.courseId }).from(courseModules).where(eq(courseModules.id, moduleId));
  if (!module) return { error: "This module no longer exists." };
  const user = await requireCourseEditor(module.courseId);
  const parsed = lessonSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const [lesson] = await db.insert(lessons).values({
    ...parsed.data,
    moduleId,
    videoUrl: parsed.data.videoUrl || null,
    resourceUrl: parsed.data.resourceUrl || null,
    published: formData.get("published") === "on",
  }).returning({ id: lessons.id });
  refreshCourseLearning(module.courseId);
  const cohortId = Number(formData.get("cohort"));
  redirect(user.role === "admin" ? `/admin/lessons/${lesson.id}?created=1` : `/teach/lessons/${lesson.id}?created=1${Number.isInteger(cohortId) && cohortId > 0 ? `&cohort=${cohortId}` : ""}`);
}

export async function updateLesson(lessonId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const [existing] = await db.select({ courseId: courseModules.courseId }).from(lessons).innerJoin(courseModules, eq(courseModules.id, lessons.moduleId)).where(eq(lessons.id, lessonId));
  if (!existing) return { error: "This lesson no longer exists." };
  await requireCourseEditor(existing.courseId);
  const parsed = lessonSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const [row] = await db.update(lessons).set({
    ...parsed.data,
    videoUrl: parsed.data.videoUrl || null,
    resourceUrl: parsed.data.resourceUrl || null,
    published: formData.get("published") === "on",
    updatedAt: new Date(),
  }).where(eq(lessons.id, lessonId)).returning({ moduleId: lessons.moduleId });
  if (!row) return { error: "This lesson no longer exists." };
  const [module] = await db.select({ courseId: courseModules.courseId }).from(courseModules).where(eq(courseModules.id, row.moduleId));
  if (module) refreshCourseLearning(module.courseId);
  return { ok: "Lesson saved." };
}

export async function deleteLesson(lessonId: number): Promise<void> {
  await requireRole("admin");
  const db = await getDb();
  const [lesson] = await db.select({ moduleId: lessons.moduleId }).from(lessons).where(eq(lessons.id, lessonId));
  if (!lesson) redirect("/admin/courses");
  const [module] = await db.select({ courseId: courseModules.courseId }).from(courseModules).where(eq(courseModules.id, lesson.moduleId));
  await db.delete(lessons).where(eq(lessons.id, lessonId));
  if (module) refreshCourseLearning(module.courseId);
  redirect(`/admin/modules/${lesson.moduleId}`);
}

export async function setLessonComplete(cohortId: number, lessonId: number, complete: boolean): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const [allowed] = await db
    .select({ enrollmentId: enrollments.id, releaseAt: moduleReleases.releaseAt })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courseModules, eq(courseModules.courseId, cohorts.courseId))
    .innerJoin(lessons, eq(lessons.moduleId, courseModules.id))
    .leftJoin(moduleReleases, and(eq(moduleReleases.cohortId, cohorts.id), eq(moduleReleases.moduleId, courseModules.id)))
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.cohortId, cohortId), eq(lessons.id, lessonId), eq(courseModules.published, true), eq(lessons.published, true)));
  if (!allowed || (allowed.releaseAt && allowed.releaseAt > new Date())) return;
  // A lesson with a required quiz is completed by passing the quiz, not by the button.
  if (complete) {
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId));
    if (quiz?.requiredToComplete && !(await quizStatus(allowed.enrollmentId, quiz)).passed) return;
  }
  await db.insert(lessonProgress).values({ enrollmentId: allowed.enrollmentId, lessonId, completedAt: complete ? new Date() : null })
    .onConflictDoUpdate({ target: [lessonProgress.enrollmentId, lessonProgress.lessonId], set: { completedAt: complete ? new Date() : null } });
  revalidatePath(`/dashboard/cohorts/${cohortId}/learn`, "layout");
  revalidatePath("/dashboard");
}

export async function startLesson(cohortId: number, lessonId: number): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const [allowed] = await db
    .select({ enrollmentId: enrollments.id, releaseAt: moduleReleases.releaseAt })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courseModules, eq(courseModules.courseId, cohorts.courseId))
    .innerJoin(lessons, eq(lessons.moduleId, courseModules.id))
    .leftJoin(moduleReleases, and(eq(moduleReleases.cohortId, cohorts.id), eq(moduleReleases.moduleId, courseModules.id)))
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.cohortId, cohortId), eq(lessons.id, lessonId), eq(courseModules.published, true), eq(lessons.published, true)));
  if (!allowed || (allowed.releaseAt && allowed.releaseAt > new Date())) return;
  await db.insert(lessonProgress).values({ enrollmentId: allowed.enrollmentId, lessonId }).onConflictDoNothing();
  revalidatePath(`/dashboard/cohorts/${cohortId}/learn`);
}

export async function setModuleRelease(cohortId: number, moduleId: number, _state: FormState, formData: FormData): Promise<FormState> {
  await requireTeacher(cohortId);
  const db = await getDb();
  const [valid] = await db.select({ moduleId: courseModules.id }).from(cohorts).innerJoin(courseModules, eq(courseModules.courseId, cohorts.courseId)).where(and(eq(cohorts.id, cohortId), eq(courseModules.id, moduleId)));
  if (!valid) return { error: "That module does not belong to this cohort's course." };
  const raw = String(formData.get("releaseAt") ?? "").trim();
  if (!raw) {
    await db.delete(moduleReleases).where(and(eq(moduleReleases.cohortId, cohortId), eq(moduleReleases.moduleId, moduleId)));
  } else {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return { error: "Choose a valid release date and time." };
    const releaseAt = fromZonedInput(raw, (await getSettings()).timezone);
    await db.insert(moduleReleases).values({ cohortId, moduleId, releaseAt }).onConflictDoUpdate({ target: [moduleReleases.cohortId, moduleReleases.moduleId], set: { releaseAt } });
  }
  revalidatePath(`/teach/cohorts/${cohortId}`);
  revalidatePath(`/dashboard/cohorts/${cohortId}/learn`, "layout");
  return { ok: raw ? "Release scheduled." : "Module is available immediately." };
}
