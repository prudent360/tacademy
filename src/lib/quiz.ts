import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { cohorts, courseModules, courses, enrollments, lessonProgress, lessons, moduleReleases, quizAttempts, quizQuestions, quizzes, type QuizQuestion } from "@/db/schema";

/** Extra time allowed after a time limit runs out, for slow connections. */
export const QUIZ_GRACE_MS = 2 * 60 * 1000;

/** When a timed attempt must be handed in by, and whether that (plus the grace period) has passed. */
export function attemptDeadline(attempt: { startedAt: Date }, quiz: { timeLimitMinutes: number | null }): { deadline: Date | null; expired: boolean } {
  if (!quiz.timeLimitMinutes) return { deadline: null, expired: false };
  const deadline = new Date(attempt.startedAt.getTime() + quiz.timeLimitMinutes * 60_000);
  return { deadline, expired: Date.now() > deadline.getTime() + QUIZ_GRACE_MS };
}

/** The student's enrolment and the lesson, when they can open it (enrolled, published and released). */
export async function lessonAccess(userId: number, cohortId: number, lessonId: number) {
  const [found] = await (await getDb())
    .select({ enrollmentId: enrollments.id, lesson: lessons, courseId: courses.id, releaseAt: moduleReleases.releaseAt })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .innerJoin(courseModules, eq(courseModules.courseId, courses.id))
    .innerJoin(lessons, eq(lessons.moduleId, courseModules.id))
    .leftJoin(moduleReleases, and(eq(moduleReleases.cohortId, cohorts.id), eq(moduleReleases.moduleId, courseModules.id)))
    .where(and(eq(enrollments.userId, userId), eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["active", "completed"]), eq(lessons.id, lessonId), eq(courseModules.published, true), eq(lessons.published, true)));
  if (!found || (found.releaseAt && found.releaseAt > new Date())) return null;
  return found;
}

/** A question is right only when exactly the correct options were chosen. */
export function isCorrect(question: Pick<QuizQuestion, "correct">, chosen: number[] | undefined): boolean {
  const want = [...new Set(question.correct)].sort();
  const got = [...new Set(chosen ?? [])].sort();
  return want.length > 0 && want.length === got.length && want.every((v, i) => v === got[i]);
}

/** Whether an attempt got a question right: SQL questions were marked when submitted, others by the options chosen. */
export function questionCorrect(question: Pick<QuizQuestion, "id" | "kind" | "correct">, attempt: { answers: Record<string, number[]>; sqlCorrect: Record<string, boolean> }): boolean {
  return question.kind === "sql" ? attempt.sqlCorrect[question.id] === true : isCorrect(question, attempt.answers[question.id]);
}

export type QuizStatus = { attemptsUsed: number; attemptsLeft: number | null; best: number | null; passed: boolean };

/** How a student is doing on a quiz: attempts used, best score and whether they've passed. */
export async function quizStatus(enrollmentId: number, quiz: { id: number; maxAttempts: number | null }): Promise<QuizStatus> {
  const done = await (await getDb()).select({ score: quizAttempts.score, passed: quizAttempts.passed }).from(quizAttempts)
    .where(and(eq(quizAttempts.enrollmentId, enrollmentId), eq(quizAttempts.quizId, quiz.id), isNotNull(quizAttempts.submittedAt)));
  const scores = done.map((a) => a.score ?? 0);
  return {
    attemptsUsed: done.length,
    attemptsLeft: quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - done.length),
    best: scores.length ? Math.max(...scores) : null,
    passed: done.some((a) => a.passed),
  };
}

/** Published quizzes (with questions) in a course's published lessons. */
export async function courseQuizzes(courseId: number) {
  const db = await getDb();
  const rows = await db.select({ quiz: quizzes, lesson: lessons }).from(quizzes)
    .innerJoin(lessons, eq(lessons.id, quizzes.lessonId))
    .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
    .where(and(eq(courseModules.courseId, courseId), eq(courseModules.published, true), eq(lessons.published, true)));
  if (!rows.length) return [];
  const withQuestions = new Set((await db.select({ quizId: quizQuestions.quizId }).from(quizQuestions).where(inArray(quizQuestions.quizId, rows.map((r) => r.quiz.id)))).map((q) => q.quizId));
  return rows.filter((r) => withQuestions.has(r.quiz.id));
}

/** Average of the student's best score on each quiz in the course (unattempted quizzes count as 0); null when the course has no quizzes. */
export async function courseQuizAverage(enrollmentId: number, courseId: number): Promise<number | null> {
  const list = await courseQuizzes(courseId);
  if (!list.length) return null;
  const attempts = await (await getDb()).select({ quizId: quizAttempts.quizId, score: quizAttempts.score }).from(quizAttempts)
    .where(and(eq(quizAttempts.enrollmentId, enrollmentId), inArray(quizAttempts.quizId, list.map((r) => r.quiz.id)), isNotNull(quizAttempts.submittedAt)));
  const best = list.map((r) => Math.max(0, ...attempts.filter((a) => a.quizId === r.quiz.id).map((a) => a.score ?? 0)));
  return Math.round(best.reduce((a, b) => a + b, 0) / best.length);
}

export async function markLessonComplete(enrollmentId: number, lessonId: number): Promise<void> {
  await (await getDb()).insert(lessonProgress).values({ enrollmentId, lessonId, completedAt: new Date() })
    .onConflictDoUpdate({ target: [lessonProgress.enrollmentId, lessonProgress.lessonId], set: { completedAt: new Date() } });
}

export type QuizReportRow = { quizId: number; lessonId: number; lessonTitle: string; questions: number; attempted: number; passed: number; averageBest: number | null; hardest: { prompt: string; percentCorrect: number } | null };

/** Per-quiz results for one cohort, for instructors: take-up, pass rate, average best score and the question most students miss. */
export async function cohortQuizReport(cohortId: number, courseId: number): Promise<QuizReportRow[]> {
  const list = await courseQuizzes(courseId);
  if (!list.length) return [];
  const db = await getDb();
  const quizIds = list.map((r) => r.quiz.id);
  const [attempts, questions] = await Promise.all([
    db.select({ attempt: quizAttempts, userId: enrollments.userId }).from(quizAttempts).innerJoin(enrollments, eq(enrollments.id, quizAttempts.enrollmentId))
      .where(and(eq(enrollments.cohortId, cohortId), inArray(quizAttempts.quizId, quizIds), isNotNull(quizAttempts.submittedAt))),
    db.select().from(quizQuestions).where(inArray(quizQuestions.quizId, quizIds)),
  ]);
  return list.map(({ quiz, lesson }) => {
    const mine = attempts.filter((a) => a.attempt.quizId === quiz.id);
    const students = [...new Set(mine.map((a) => a.userId))];
    const best = students.map((id) => Math.max(...mine.filter((a) => a.userId === id).map((a) => a.attempt.score ?? 0)));
    const qs = questions.filter((q) => q.quizId === quiz.id);
    const rates = qs.map((q) => {
      const asked = mine.filter((a) => a.attempt.questionOrder.includes(q.id));
      return { prompt: q.prompt, asked: asked.length, percentCorrect: asked.length ? Math.round((asked.filter((a) => questionCorrect(q, a.attempt)).length / asked.length) * 100) : 100 };
    }).filter((r) => r.asked > 0).sort((a, b) => a.percentCorrect - b.percentCorrect);
    return {
      quizId: quiz.id,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      questions: qs.length,
      attempted: students.length,
      passed: students.filter((id) => mine.some((a) => a.userId === id && a.attempt.passed)).length,
      averageBest: best.length ? Math.round(best.reduce((a, b) => a + b, 0) / best.length) : null,
      hardest: rates[0] && rates[0].percentCorrect < 100 ? { prompt: rates[0].prompt, percentCorrect: rates[0].percentCorrect } : null,
    };
  });
}
