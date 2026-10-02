"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { cohorts, courseModules, courses, enrollments, lessonProgress, lessons, moduleReleases, quizzes } from "@/db/schema";
import { requireCourseEditor, requireTeacher, requireUser, requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { quizStatus } from "@/lib/quiz";
import { fromZonedInput } from "@/lib/time";
import { firstError, formValues, optionalUrl, required, sortValue, text, type FormState } from "@/lib/validation";

const lessonSchema = z.object({
  title: required("Lesson title", 160),
  summary: text(500),
  content: text(100_000),
  videoUrl: optionalUrl,
  resourceUrl: optionalUrl,
  resourceLabel: text(120),
  estimatedMinutes: z.coerce.number().int().min(1, "Estimated time must be at least one minute.").max(600),
  position: sortValue.optional(),
});

function refreshCourseLearning(courseId: number) {
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/teach", "layout");
  revalidatePath("/dashboard", "layout");
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
    position: formData.has("position") ? parsed.data.position : await nextLessonPosition(moduleId),
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
  const { position, ...fields } = parsed.data;
  const [row] = await db.update(lessons).set({
    ...fields,
    ...(formData.has("position") ? { position } : {}),
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
  await requirePermission("courses.manage");
  const db = await getDb();
  const [lesson] = await db.select({ moduleId: lessons.moduleId }).from(lessons).where(eq(lessons.id, lessonId));
  if (!lesson) redirect("/admin/courses");
  const [module] = await db.select({ courseId: courseModules.courseId }).from(courseModules).where(eq(courseModules.id, lesson.moduleId));
  await db.delete(lessons).where(eq(lessons.id, lessonId));
  if (module) refreshCourseLearning(module.courseId);
  redirect(module ? `/admin/courses/${module.courseId}#curriculum` : "/admin/courses");
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

// ---------- Curriculum builder ----------

type BuilderResult = { ok: true; id?: number } | { error: string };

async function nextModulePosition(courseId: number): Promise<number> {
  const rows = await (await getDb()).select({ position: courseModules.position }).from(courseModules).where(eq(courseModules.courseId, courseId));
  return rows.reduce((max, r) => Math.max(max, r.position + 1), 0);
}

async function nextLessonPosition(moduleId: number): Promise<number> {
  const rows = await (await getDb()).select({ position: lessons.position }).from(lessons).where(eq(lessons.moduleId, moduleId));
  return rows.reduce((max, r) => Math.max(max, r.position + 1), 0);
}

async function moduleCourse(moduleId: number): Promise<number | null> {
  const [row] = await (await getDb()).select({ courseId: courseModules.courseId }).from(courseModules).where(eq(courseModules.id, moduleId));
  return row?.courseId ?? null;
}

async function lessonCourse(lessonId: number): Promise<number | null> {
  const [row] = await (await getDb()).select({ courseId: courseModules.courseId }).from(lessons).innerJoin(courseModules, eq(courseModules.id, lessons.moduleId)).where(eq(lessons.id, lessonId));
  return row?.courseId ?? null;
}

const titleSchema = required("Title", 160);

/** Adds a module at the end of the course. */
export async function addModule(courseId: number, title: string): Promise<BuilderResult> {
  await requireCourseEditor(courseId);
  const parsed = titleSchema.safeParse(title);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId));
  if (!course) return { error: "This course no longer exists." };
  const [module] = await db.insert(courseModules).values({ courseId, title: parsed.data, position: await nextModulePosition(courseId) }).returning({ id: courseModules.id });
  refreshCourseLearning(courseId);
  return { ok: true, id: module.id };
}

/** Renames a module and updates its summary. */
export async function saveModuleDetails(moduleId: number, title: string, summary: string): Promise<BuilderResult> {
  const courseId = await moduleCourse(moduleId);
  if (!courseId) return { error: "This module no longer exists." };
  await requireCourseEditor(courseId);
  const parsed = z.object({ title: titleSchema, summary: text(500) }).safeParse({ title, summary });
  if (!parsed.success) return { error: firstError(parsed.error) };
  await (await getDb()).update(courseModules).set({ ...parsed.data, updatedAt: new Date() }).where(eq(courseModules.id, moduleId));
  refreshCourseLearning(courseId);
  return { ok: true };
}

/** Adds a draft lesson, or a quiz (a lesson whose quiz must be passed), at the end of a module. */
export async function addLesson(moduleId: number, title: string, kind: "lesson" | "quiz"): Promise<BuilderResult> {
  const courseId = await moduleCourse(moduleId);
  if (!courseId) return { error: "This module no longer exists." };
  await requireCourseEditor(courseId);
  const parsed = titleSchema.safeParse(title);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [lesson] = await db.insert(lessons).values({ moduleId, title: parsed.data, position: await nextLessonPosition(moduleId), estimatedMinutes: kind === "quiz" ? 15 : 10 }).returning({ id: lessons.id });
  if (kind === "quiz") await db.insert(quizzes).values({ lessonId: lesson.id, requiredToComplete: true });
  refreshCourseLearning(courseId);
  return { ok: true, id: lesson.id };
}

/** The one switch that decides whether students see a lesson (release dates still apply per cohort). */
export async function setLessonPublished(lessonId: number, published: boolean): Promise<BuilderResult> {
  const courseId = await lessonCourse(lessonId);
  if (!courseId) return { error: "This lesson no longer exists." };
  await requireCourseEditor(courseId);
  await (await getDb()).update(lessons).set({ published, updatedAt: new Date() }).where(eq(lessons.id, lessonId));
  refreshCourseLearning(courseId);
  return { ok: true };
}

/** Saves the builder's order: modules in order, each with its lessons in order (lessons can move between modules). */
export async function reorderCurriculum(courseId: number, layout: { id: number; lessons: number[] }[]): Promise<BuilderResult> {
  await requireCourseEditor(courseId);
  const db = await getDb();
  const moduleIds = layout.map((m) => m.id);
  const lessonIds = layout.flatMap((m) => m.lessons);
  const owned = moduleIds.length ? await db.select({ id: courseModules.id }).from(courseModules).where(and(eq(courseModules.courseId, courseId), inArray(courseModules.id, moduleIds))) : [];
  const ownedLessons = lessonIds.length ? await db.select({ id: lessons.id }).from(lessons).innerJoin(courseModules, eq(courseModules.id, lessons.moduleId)).where(and(eq(courseModules.courseId, courseId), inArray(lessons.id, lessonIds))) : [];
  if (owned.length !== new Set(moduleIds).size || ownedLessons.length !== new Set(lessonIds).size) return { error: "The curriculum changed in the meantime. Reload the page and try again." };
  await db.transaction(async (tx) => {
    for (const [i, module] of layout.entries()) {
      await tx.update(courseModules).set({ position: i }).where(eq(courseModules.id, module.id));
      for (const [j, lessonId] of module.lessons.entries()) await tx.update(lessons).set({ moduleId: module.id, position: j }).where(eq(lessons.id, lessonId));
    }
  });
  refreshCourseLearning(courseId);
  return { ok: true };
}

/** Deletes a module and its lessons from the builder (admins only). */
export async function removeModule(moduleId: number): Promise<BuilderResult> {
  await requirePermission("courses.manage");
  const [row] = await (await getDb()).delete(courseModules).where(eq(courseModules.id, moduleId)).returning({ courseId: courseModules.courseId });
  if (row) refreshCourseLearning(row.courseId);
  return { ok: true };
}

/** Deletes a lesson from the builder (admins only). */
export async function removeLesson(lessonId: number): Promise<BuilderResult> {
  await requirePermission("courses.manage");
  const courseId = await lessonCourse(lessonId);
  await (await getDb()).delete(lessons).where(eq(lessons.id, lessonId));
  if (courseId) refreshCourseLearning(courseId);
  return { ok: true };
}
