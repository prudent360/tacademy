import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { startQuiz, submitQuiz } from "@/app/actions/quiz";
import { CheckCircleIcon, XIcon } from "@/components/icons";
import { QuizTimer } from "@/components/quiz/quiz-timer";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { quizAttempts, quizQuestions, quizzes, sqlDatasets, type QuizQuestion } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { SqlQuestion } from "@/components/sql/sql-question";
import { attemptDeadline, lessonAccess, questionCorrect, quizStatus } from "@/lib/quiz";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Quiz" };

const button = "inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-accent px-5 font-semibold text-white hover:bg-accent-dark";
const secondary = "inline-flex h-11 items-center justify-center rounded-lg border border-edge-strong bg-surface px-5 font-semibold text-ink hover:bg-page";

export default async function QuizPage({ params, searchParams }: { params: Promise<{ id: string; lessonId: string }>; searchParams: Promise<{ attempt?: string }> }) {
  const [{ id: rawCohort, lessonId: rawLesson }, { attempt: rawAttempt }, user] = await Promise.all([params, searchParams, requireUser()]);
  const cohortId = idParam(rawCohort);
  const lessonId = idParam(rawLesson);
  if (!cohortId || !lessonId) notFound();
  const access = await lessonAccess(user.id, cohortId, lessonId);
  if (!access) notFound();
  const db = await getDb();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId));
  if (!quiz) notFound();
  const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id));
  if (!questions.length) notFound();
  const status = await quizStatus(access.enrollmentId, quiz);
  const lessonHref = `/dashboard/cohorts/${cohortId}/learn/${lessonId}`;
  const attemptId = idParam(rawAttempt ?? "");
  const [attempt] = attemptId ? await db.select().from(quizAttempts).where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.enrollmentId, access.enrollmentId), eq(quizAttempts.quizId, quiz.id))) : [];
  const header = <PageHeader back={{ href: lessonHref, label: access.lesson.title }} title={`Quiz: ${access.lesson.title}`} description={`${questions.length} question${questions.length === 1 ? "" : "s"} · pass mark ${quiz.passPercent}%${quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} minute limit` : ""}`} />;
  const canRetake = status.attemptsLeft !== 0;
  const retake = canRetake && <form action={startQuiz.bind(null, cohortId, lessonId)}><button type="submit" className={status.passed ? secondary : button}>{status.passed ? "Take it again" : "Try again"}</button></form>;

  // No attempt open: status and a start button.
  if (!attempt) {
    return <>
      {header}
      <Card>
        <div className="flex flex-col gap-4">
          {status.attemptsUsed > 0 && <p className="text-body">Best score so far: <strong className="text-ink">{status.best}%</strong> {status.passed ? <Badge tone="green">Passed</Badge> : <Badge tone="amber">Not passed yet</Badge>}</p>}
          <p className="text-sm text-muted">{status.attemptsLeft === null ? "You can take this quiz as many times as you like." : `${status.attemptsLeft} of ${quiz.maxAttempts} attempt${quiz.maxAttempts === 1 ? "" : "s"} left.`}{quiz.requiredToComplete && " You need to pass it to complete the lesson."}</p>
          {canRetake ? <form action={startQuiz.bind(null, cohortId, lessonId)}><button type="submit" className={button}>{status.attemptsUsed ? "Start a new attempt" : "Start quiz"}</button></form> : <Notice tone="amber">You&apos;ve used all your attempts. Ask your instructor if you need another.</Notice>}
        </div>
      </Card>
    </>;
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  const ordered = attempt.questionOrder.map((id) => byId.get(id)).filter((q): q is QuizQuestion => Boolean(q));
  const datasetIds = [...new Set(ordered.flatMap((q) => (q.kind === "sql" && q.datasetId ? [q.datasetId] : [])))];
  const datasets = datasetIds.length ? await db.select({ id: sqlDatasets.id, updatedAt: sqlDatasets.updatedAt, tables: sqlDatasets.tables }).from(sqlDatasets).where(inArray(sqlDatasets.id, datasetIds)) : [];

  // In progress: the questions (correct answers never reach the browser before submitting).
  if (!attempt.submittedAt) {
    const { deadline, expired } = attemptDeadline(attempt, quiz);
    const formId = `quiz-${attempt.id}`;
    return <>
      {header}
      {expired && <Notice tone="amber">Time is up for this attempt. Submitting now will record it without answers.</Notice>}
      <form id={formId} action={submitQuiz.bind(null, cohortId, lessonId, attempt.id)} className="flex flex-col gap-5">
        {deadline && !expired && <div className="sticky top-20 z-10 flex justify-end"><QuizTimer deadline={deadline.toISOString()} formId={formId} /></div>}
        {ordered.map((q, i) => (
          <Card key={q.id}>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Question {i + 1} of {ordered.length}{q.kind === "multiple" && " · select all that apply"}{q.kind === "sql" && " · write a SQL query"}</span>
                <span className="whitespace-pre-wrap text-lg font-semibold text-ink">{q.prompt}</span>
              </legend>
              {q.kind === "sql" && (() => {
                const dataset = datasets.find((d) => d.id === q.datasetId);
                // Only what the student needs goes to the browser: never the answer query or its result.
                return dataset ? <SqlQuestion questionId={q.id} position={i + 1} dataset={{ id: dataset.id, version: dataset.updatedAt.toISOString(), tables: dataset.tables }} starter={q.starterSql} columns={q.expected?.columns.length ?? 0} /> : <p className="text-sm text-muted">This question&apos;s dataset is missing. Tell your instructor.</p>;
              })()}
              {q.options.map((option, j) => (
                <label key={j} className="flex cursor-pointer items-start gap-3 rounded-lg border border-edge-strong px-4 py-3 text-[15px] text-body transition hover:border-accent-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft/60">
                  <input type={q.kind === "multiple" ? "checkbox" : "radio"} name={`q-${q.id}`} value={j} className="mt-1 size-4 shrink-0 accent-accent" />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          </Card>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Unanswered questions count as wrong.</p>
          <button type="submit" className={button}>Submit answers</button>
        </div>
      </form>
    </>;
  }

  // Submitted: the result. Correct answers are shown once they've passed or have no attempts left.
  const reveal = status.passed || status.attemptsLeft === 0;
  return <>
    {header}
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={`flex size-16 items-center justify-center rounded-full font-display text-xl font-bold ${attempt.passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{attempt.score}%</span>
          <div>
            <p className="font-display text-xl font-bold text-ink">{attempt.passed ? "You passed!" : "Not quite yet"}</p>
            <p className="text-sm text-muted">{attempt.correctCount} of {attempt.total} correct · pass mark {quiz.passPercent}%{attempt.passed && quiz.requiredToComplete ? " · lesson marked complete" : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">{!attempt.passed && retake}<Link href={lessonHref} className={attempt.passed ? button : secondary}>Back to the lesson</Link></div>
      </div>
      {!reveal && <p className="mt-4 text-sm text-muted">Review the lesson and try again. The correct answers are shown once you pass{status.attemptsLeft !== null ? " or use all your attempts" : ""}.</p>}
    </Card>
    <div className="flex flex-col gap-3">
      {ordered.map((q, i) => {
        const chosen = attempt.answers[q.id] ?? [];
        const right = questionCorrect(q, attempt);
        return (
          <Card key={q.id}>
            <div className="flex flex-col gap-3">
              <p className="flex items-start gap-2 font-semibold text-ink">
                {right ? <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <XIcon className="mt-0.5 size-5 shrink-0 text-red-600" />}
                <span>{i + 1}. {q.prompt}</span>
              </p>
              {q.kind === "sql" && (
                <div className="flex flex-col gap-2 pl-7 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your query</p>
                  <pre className="overflow-x-auto rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-[13px] text-ink">{attempt.sqlAnswers[q.id]?.trim() || "(no query)"}</pre>
                  {!right && <p className="text-muted">Its result didn&apos;t match the expected one{q.orderMatters ? " (row order counts for this question)" : ""}.</p>}
                  {reveal && (<>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">A correct answer</p>
                    <pre className="overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-[13px] text-emerald-900">{q.solutionSql}</pre>
                  </>)}
                </div>
              )}
              <ul className="flex flex-col gap-1.5 pl-7 text-sm">
                {q.options.map((option, j) => {
                  const picked = chosen.includes(j);
                  const correct = reveal && q.correct.includes(j);
                  return <li key={j} className={correct ? "font-semibold text-emerald-700" : picked && reveal ? "text-red-700 line-through" : picked ? "font-semibold text-ink" : "text-muted"}>{picked ? "● " : "○ "}{option}{correct && " ✓"}</li>;
                })}
              </ul>
              {reveal && q.explanation && <p className="ml-7 rounded-lg bg-panel px-3 py-2 text-sm text-body">{q.explanation}</p>}
            </div>
          </Card>
        );
      })}
    </div>
  </>;
}
