"use server";

import { and, asc, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { courseModules, lessons, quizAttempts, quizQuestions, quizzes, type QuestionKind } from "@/db/schema";
import { aiQuota, askAi } from "@/lib/ai";
import { requireCourseEditor, requireUser } from "@/lib/auth";
import { isCorrect, lessonAccess, markLessonComplete, QUIZ_GRACE_MS, quizStatus } from "@/lib/quiz";
import type { FormState } from "@/lib/validation";

const MAX_OPTIONS = 6;

function refresh() {
  revalidatePath("/teach", "layout");
  revalidatePath("/admin/lessons", "layout");
  revalidatePath("/dashboard", "layout");
}

/** The course a lesson belongs to, after checking the person can edit it. */
async function editLesson(lessonId: number) {
  const [row] = await (await getDb()).select({ courseId: courseModules.courseId }).from(lessons).innerJoin(courseModules, eq(courseModules.id, lessons.moduleId)).where(eq(lessons.id, lessonId));
  if (!row) return null;
  return requireCourseEditor(row.courseId);
}

async function editQuiz(quizId: number) {
  const [quiz] = await (await getDb()).select().from(quizzes).where(eq(quizzes.id, quizId));
  if (!quiz) return null;
  const user = await editLesson(quiz.lessonId);
  return user ? { quiz, user } : null;
}

/** Fisher–Yates: every order equally likely. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- Authoring ----------

export async function createQuiz(lessonId: number): Promise<void> {
  if (!(await editLesson(lessonId))) return;
  await (await getDb()).insert(quizzes).values({ lessonId }).onConflictDoNothing();
  refresh();
}

export async function deleteQuiz(quizId: number): Promise<void> {
  if (!(await editQuiz(quizId))) return;
  await (await getDb()).delete(quizzes).where(eq(quizzes.id, quizId));
  refresh();
}

const optionalWhole = (label: string, min: number, max: number) =>
  z.string().trim().refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), `${label} must be between ${min} and ${max}, or empty.`);

export async function updateQuiz(quizId: number, _state: FormState, formData: FormData): Promise<FormState> {
  if (!(await editQuiz(quizId))) return { error: "This quiz no longer exists." };
  const parsed = z.object({
    passPercent: z.coerce.number().int().min(1, "The pass mark must be between 1% and 100%.").max(100, "The pass mark must be between 1% and 100%."),
    maxAttempts: optionalWhole("Attempts", 1, 20),
    timeLimitMinutes: optionalWhole("The time limit", 1, 180),
  }).safeParse({ passPercent: formData.get("passPercent"), maxAttempts: String(formData.get("maxAttempts") ?? ""), timeLimitMinutes: String(formData.get("timeLimitMinutes") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the quiz settings." };
  await (await getDb()).update(quizzes).set({
    passPercent: parsed.data.passPercent,
    maxAttempts: parsed.data.maxAttempts ? Number(parsed.data.maxAttempts) : null,
    timeLimitMinutes: parsed.data.timeLimitMinutes ? Number(parsed.data.timeLimitMinutes) : null,
    shuffle: formData.get("shuffle") === "on",
    requiredToComplete: formData.get("requiredToComplete") === "on",
    updatedAt: new Date(),
  }).where(eq(quizzes.id, quizId));
  refresh();
  return { ok: "Quiz settings saved." };
}

type QuestionInput = { kind: QuestionKind; prompt: string; options: string[]; correct: number[]; explanation: string };

/** Checks a question makes sense: 2–6 options, and one right answer (or at least one for "select all"). */
function checkQuestion(q: QuestionInput): string | null {
  if (!q.prompt.trim()) return "Write the question.";
  if (q.options.length < 2) return "Add at least two answer options.";
  if (q.correct.some((i) => i < 0 || i >= q.options.length)) return "Mark which answers are correct.";
  if (q.kind !== "multiple" && q.correct.length !== 1) return "Mark exactly one correct answer.";
  if (q.kind === "multiple" && q.correct.length < 1) return "Mark at least one correct answer.";
  return null;
}

function questionFromForm(formData: FormData): QuestionInput {
  const kind = (["single", "multiple", "truefalse"] as const).find((k) => k === formData.get("kind")) ?? "single";
  const prompt = String(formData.get("prompt") ?? "").trim().slice(0, 1000);
  const explanation = String(formData.get("explanation") ?? "").trim().slice(0, 1000);
  if (kind === "truefalse") return { kind, prompt, explanation, options: ["True", "False"], correct: formData.get("truth") === "false" ? [1] : [0] };
  // Keep the options that were filled in, remembering which of them were marked correct.
  const raw = Array.from({ length: MAX_OPTIONS }, (_, i) => ({ text: String(formData.get(`option-${i}`) ?? "").trim().slice(0, 300), correct: formData.getAll("correct").includes(String(i)) }));
  const kept = raw.filter((o) => o.text);
  return { kind, prompt, explanation, options: kept.map((o) => o.text), correct: kept.flatMap((o, i) => (o.correct ? [i] : [])) };
}

export async function saveQuestion(quizId: number, questionId: number | null, _state: FormState, formData: FormData): Promise<FormState> {
  if (!(await editQuiz(quizId))) return { error: "This quiz no longer exists." };
  const question = questionFromForm(formData);
  const problem = checkQuestion(question);
  if (problem) return { error: problem };
  const db = await getDb();
  if (questionId) {
    const [row] = await db.update(quizQuestions).set(question).where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId))).returning({ id: quizQuestions.id });
    if (!row) return { error: "This question no longer exists." };
  } else {
    const [{ n }] = await db.select({ n: count() }).from(quizQuestions).where(eq(quizQuestions.quizId, quizId));
    await db.insert(quizQuestions).values({ ...question, quizId, position: n });
  }
  refresh();
  return { ok: questionId ? "Question saved." : "Question added." };
}

export async function deleteQuestion(questionId: number): Promise<void> {
  const db = await getDb();
  const [question] = await db.select({ quizId: quizQuestions.quizId }).from(quizQuestions).where(eq(quizQuestions.id, questionId));
  if (!question || !(await editQuiz(question.quizId))) return;
  await db.delete(quizQuestions).where(eq(quizQuestions.id, questionId));
  refresh();
}

const generated = z.object({
  questions: z.array(z.object({
    kind: z.enum(["single", "multiple", "truefalse"]),
    prompt: z.string(),
    options: z.array(z.string()),
    correct: z.array(z.number().int()),
    explanation: z.string(),
  })),
});

/** Drafts questions from the lesson's content with AI and adds the valid ones for the instructor to review. */
export async function generateQuestions(quizId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const editing = await editQuiz(quizId);
  if (!editing) return { error: "This quiz no longer exists." };
  const { quiz, user } = editing;
  const limited = await aiQuota("writing", String(user.id), 60);
  if (limited) return { error: limited };
  const howMany = Math.min(10, Math.max(1, Number(formData.get("count")) || 5));
  const db = await getDb();
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, quiz.lessonId));
  if (!lesson?.content.trim() && !lesson?.summary.trim()) return { error: "Add some written lesson content first, so the questions can be based on it." };
  const existing = await db.select({ prompt: quizQuestions.prompt }).from(quizQuestions).where(eq(quizQuestions.quizId, quizId));

  const result = await askAi("writing", {
    system: `You write clear, fair quiz questions that check a student understood a lesson. Base every question only on the lesson content. Mix single-choice questions (one correct answer, 3–4 options), a few "select all that apply" questions (2–4 correct), and occasional true/false statements. Make wrong options plausible, avoid "all of the above", trick wording and questions answerable without the lesson. Give each a one- or two-sentence explanation of the right answer. For truefalse questions, options must be exactly ["True", "False"]. The correct field lists zero-based indexes into options.`,
    context: `Lesson: ${lesson.title}\n${lesson.summary ? `Summary: ${lesson.summary}\n` : ""}\nContent:\n${lesson.content}`,
    messages: [{ role: "user", content: `Write ${howMany} new questions.${existing.length ? ` Avoid repeating these existing questions:\n${existing.map((q) => `- ${q.prompt}`).join("\n")}` : ""}` }],
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["single", "multiple", "truefalse"] },
              prompt: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correct: { type: "array", items: { type: "integer" } },
              explanation: { type: "string" },
            },
            required: ["kind", "prompt", "options", "correct", "explanation"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
  });
  if ("error" in result) return result;
  let parsed: z.infer<typeof generated>;
  try {
    const checked = generated.safeParse(JSON.parse(result.text));
    if (!checked.success) return { error: "The AI's questions came back incomplete. Please try again." };
    parsed = checked.data;
  } catch {
    return { error: "The AI's questions came back incomplete. Please try again." };
  }
  // Only keep questions that pass the same checks as hand-written ones.
  const valid = parsed.questions
    .map((q): QuestionInput => q.kind === "truefalse"
      ? { kind: "truefalse", prompt: q.prompt.slice(0, 1000), options: ["True", "False"], correct: [q.correct[0] === 1 ? 1 : 0], explanation: q.explanation.slice(0, 1000) }
      : { kind: q.kind, prompt: q.prompt.slice(0, 1000), options: q.options.slice(0, MAX_OPTIONS).map((o) => o.slice(0, 300)), correct: [...new Set(q.correct)], explanation: q.explanation.slice(0, 1000) })
    .filter((q) => !checkQuestion(q))
    .slice(0, howMany);
  if (!valid.length) return { error: "The AI didn't produce usable questions. Please try again." };
  await db.insert(quizQuestions).values(valid.map((q, i) => ({ ...q, quizId, position: existing.length + i })));
  refresh();
  return { ok: `Added ${valid.length} question${valid.length === 1 ? "" : "s"}. Review them below and edit anything that isn't right.` };
}

// ---------- Taking a quiz ----------

function quizPath(cohortId: number, lessonId: number, attemptId?: number) {
  return `/dashboard/cohorts/${cohortId}/learn/${lessonId}/quiz${attemptId ? `?attempt=${attemptId}` : ""}`;
}

/** Starts (or resumes) an attempt and opens it. The question order is fixed here so shuffled quizzes mark consistently. */
export async function startQuiz(cohortId: number, lessonId: number): Promise<void> {
  const user = await requireUser();
  const access = await lessonAccess(user.id, cohortId, lessonId);
  if (!access) redirect("/dashboard");
  const db = await getDb();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId));
  if (!quiz) redirect(`/dashboard/cohorts/${cohortId}/learn/${lessonId}`);
  const [open] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.enrollmentId, access.enrollmentId), isNull(quizAttempts.submittedAt)));
  if (open && (!quiz.timeLimitMinutes || open.startedAt.getTime() + quiz.timeLimitMinutes * 60_000 + QUIZ_GRACE_MS > Date.now())) redirect(quizPath(cohortId, lessonId, open.id));
  const status = await quizStatus(access.enrollmentId, quiz);
  if (status.attemptsLeft === 0) redirect(quizPath(cohortId, lessonId));
  const ids = (await db.select({ id: quizQuestions.id }).from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(asc(quizQuestions.position), asc(quizQuestions.id))).map((q) => q.id);
  if (!ids.length) redirect(`/dashboard/cohorts/${cohortId}/learn/${lessonId}`);
  const order = quiz.shuffle ? shuffled(ids) : ids;
  // An expired, unsubmitted attempt is closed as it stands before the new one starts.
  if (open) await db.update(quizAttempts).set({ submittedAt: new Date(), score: 0, total: ids.length }).where(eq(quizAttempts.id, open.id));
  const [attempt] = await db.insert(quizAttempts).values({ quizId: quiz.id, enrollmentId: access.enrollmentId, questionOrder: order, total: order.length }).returning({ id: quizAttempts.id });
  redirect(quizPath(cohortId, lessonId, attempt.id));
}

/** Marks an attempt. Answers after the time limit (plus a short grace period) aren't counted. */
export async function submitQuiz(cohortId: number, lessonId: number, attemptId: number, formData: FormData): Promise<void> {
  const user = await requireUser();
  const access = await lessonAccess(user.id, cohortId, lessonId);
  if (!access) redirect("/dashboard");
  const db = await getDb();
  const [row] = await db.select({ attempt: quizAttempts, quiz: quizzes }).from(quizAttempts).innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.enrollmentId, access.enrollmentId), eq(quizzes.lessonId, lessonId)));
  if (!row || row.attempt.submittedAt) redirect(quizPath(cohortId, lessonId, attemptId));
  const { attempt, quiz } = row;
  const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id));
  const late = quiz.timeLimitMinutes !== null && Date.now() > attempt.startedAt.getTime() + quiz.timeLimitMinutes * 60_000 + QUIZ_GRACE_MS;
  const answers: Record<string, number[]> = {};
  if (!late) for (const q of questions) answers[q.id] = formData.getAll(`q-${q.id}`).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < q.options.length);
  const asked = questions.filter((q) => attempt.questionOrder.includes(q.id));
  const correctCount = asked.filter((q) => isCorrect(q, answers[q.id])).length;
  const score = asked.length ? Math.round((correctCount / asked.length) * 100) : 0;
  const passed = score >= quiz.passPercent;
  await db.update(quizAttempts).set({ answers, correctCount, total: asked.length, score, passed, submittedAt: new Date() }).where(eq(quizAttempts.id, attemptId));
  if (passed && quiz.requiredToComplete) await markLessonComplete(access.enrollmentId, lessonId);
  revalidatePath(`/dashboard/cohorts/${cohortId}/learn`, "layout");
  revalidatePath("/dashboard");
  redirect(quizPath(cohortId, lessonId, attemptId));
}
