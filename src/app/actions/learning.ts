"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { cohorts, courseModules, courses, enrollments, lessonProgress, lessons } from "@/db/schema";
import { requireRole, requireUser } from "@/lib/auth";
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
  revalidatePath("/dashboard", "layout");
}

export async function createModule(courseId: number, _state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = moduleSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId));
  if (!course) return { error: "This course no longer exists." };
  const [module] = await db.insert(courseModules).values({ ...parsed.data, courseId, published: formData.get("published") === "on" }).returning({ id: courseModules.id });
  refreshCourseLearning(courseId);
  redirect(`/admin/modules/${module.id}?created=1`);
}

export async function updateModule(moduleId: number, _state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = moduleSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [row] = await db.update(courseModules).set({ ...parsed.data, published: formData.get("published") === "on", updatedAt: new Date() }).where(eq(courseModules.id, moduleId)).returning({ courseId: courseModules.courseId });
  if (!row) return { error: "This module no longer exists." };
  refreshCourseLearning(row.courseId);
  return { ok: "Module saved." };
}

export async function deleteModule(moduleId: number): Promise<void> {
  await requireRole("admin");
  const [row] = await (await getDb()).delete(courseModules).where(eq(courseModules.id, moduleId)).returning({ courseId: courseModules.courseId });
  if (!row) redirect("/admin/courses");
  refreshCourseLearning(row.courseId);
  redirect(`/admin/courses/${row.courseId}`);
}

export async function createLesson(moduleId: number, _state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = lessonSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [module] = await db.select({ courseId: courseModules.courseId }).from(courseModules).where(eq(courseModules.id, moduleId));
  if (!module) return { error: "This module no longer exists." };
  const [lesson] = await db.insert(lessons).values({
    ...parsed.data,
    moduleId,
    videoUrl: parsed.data.videoUrl || null,
    resourceUrl: parsed.data.resourceUrl || null,
    published: formData.get("published") === "on",
  }).returning({ id: lessons.id });
  refreshCourseLearning(module.courseId);
  redirect(`/admin/lessons/${lesson.id}?created=1`);
}

export async function updateLesson(lessonId: number, _state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = lessonSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
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
    .select({ enrollmentId: enrollments.id })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courseModules, eq(courseModules.courseId, cohorts.courseId))
    .innerJoin(lessons, eq(lessons.moduleId, courseModules.id))
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.cohortId, cohortId), eq(lessons.id, lessonId), eq(courseModules.published, true), eq(lessons.published, true)));
  if (!allowed) return;
  await db.insert(lessonProgress).values({ enrollmentId: allowed.enrollmentId, lessonId, completedAt: complete ? new Date() : null })
    .onConflictDoUpdate({ target: [lessonProgress.enrollmentId, lessonProgress.lessonId], set: { completedAt: complete ? new Date() : null } });
  revalidatePath(`/dashboard/cohorts/${cohortId}/learn`, "layout");
  revalidatePath("/dashboard");
}
