import "server-only";
import { asc, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { courseModules, lessons, quizQuestions, quizzes } from "@/db/schema";

export type BuilderLesson = {
  id: number;
  title: string;
  published: boolean;
  minutes: number;
  /** What the lesson mainly is, for its icon: a quiz with nothing else, a video, or reading. */
  kind: "quiz" | "video" | "reading";
  /** Questions in its quiz, or null when it has no quiz. */
  quizQuestions: number | null;
};
export type BuilderModule = { id: number; title: string; summary: string; lessons: BuilderLesson[] };

/** A course's modules and lessons in order, for the curriculum builder. */
export async function curriculumFor(courseId: number): Promise<BuilderModule[]> {
  const db = await getDb();
  const rows = await db.select({ module: courseModules, lesson: lessons }).from(courseModules).leftJoin(lessons, eq(lessons.moduleId, courseModules.id))
    .where(eq(courseModules.courseId, courseId)).orderBy(asc(courseModules.position), asc(courseModules.id), asc(lessons.position), asc(lessons.id));
  const lessonIds = rows.flatMap((r) => (r.lesson ? [r.lesson.id] : []));
  const quizRows = lessonIds.length
    ? await db.select({ lessonId: quizzes.lessonId, n: count(quizQuestions.id) }).from(quizzes).leftJoin(quizQuestions, eq(quizQuestions.quizId, quizzes.id)).where(inArray(quizzes.lessonId, lessonIds)).groupBy(quizzes.lessonId)
    : [];
  const questions = new Map(quizRows.map((q) => [q.lessonId, q.n]));
  const modules = new Map<number, BuilderModule>();
  for (const { module, lesson } of rows) {
    if (!modules.has(module.id)) modules.set(module.id, { id: module.id, title: module.title, summary: module.summary, lessons: [] });
    if (!lesson) continue;
    const quiz = questions.get(lesson.id) ?? null;
    const hasText = lesson.content.replace(/<[^>]*>/g, "").trim().length > 0;
    modules.get(module.id)!.lessons.push({
      id: lesson.id,
      title: lesson.title,
      published: lesson.published,
      minutes: lesson.estimatedMinutes,
      kind: lesson.videoUrl ? "video" : quiz !== null && !hasText ? "quiz" : "reading",
      quizQuestions: quiz,
    });
  }
  return [...modules.values()];
}

export type PublicModule = { title: string; summary: string; lessons: { title: string; kind: BuilderLesson["kind"]; minutes: number }[] };

/**
 * The outline visitors see on the course page: modules with at least one published lesson, built from the
 * real curriculum. Falls back to the course's hand-written outline until there is one.
 */
export async function publicCurriculum(courseId: number, fallback: { title: string; summary: string }[]): Promise<PublicModule[]> {
  const built = (await curriculumFor(courseId))
    .map((m) => ({ title: m.title, summary: m.summary, lessons: m.lessons.filter((l) => l.published).map((l) => ({ title: l.title, kind: l.kind, minutes: l.minutes })) }))
    .filter((m) => m.lessons.length > 0);
  return built.length ? built : fallback.map((m) => ({ ...m, lessons: [] }));
}
