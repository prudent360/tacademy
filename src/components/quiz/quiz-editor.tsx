import { asc, eq } from "drizzle-orm";
import { createQuiz, deleteQuestion, deleteQuiz, generateQuestions, saveQuestion, updateQuiz } from "@/app/actions/quiz";
import { ActionButton, ActionForm, Checkbox, DeleteButton, Input, Select, SubmitButton } from "@/components/forms";
import { CheckIcon, SparkIcon } from "@/components/icons";
import { Badge, Card } from "@/components/ui";
import { getDb } from "@/db";
import { quizQuestions, quizzes } from "@/db/schema";
import { aiAvailable } from "@/lib/ai";
import { QuestionForm } from "./question-form";

const KIND_LABEL = { single: "One answer", multiple: "Select all", truefalse: "True/false" } as const;

/** Quiz settings and questions for a lesson, on the admin and instructor lesson pages. */
export async function QuizEditor({ lessonId }: { lessonId: number }) {
  const db = await getDb();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId));
  if (!quiz) {
    return (
      <Card title="Quiz">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Add a short, automatically marked quiz at the end of this lesson.</p>
          <ActionButton action={createQuiz.bind(null, lessonId)} variant="primary" pendingText="Adding…">Add a quiz</ActionButton>
        </div>
      </Card>
    );
  }
  const [questions, ai] = await Promise.all([
    db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(asc(quizQuestions.position), asc(quizQuestions.id)),
    aiAvailable("writing"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <Card title="Quiz settings" action={<DeleteButton action={deleteQuiz.bind(null, quiz.id)} label="Remove quiz" />}>
        <ActionForm action={updateQuiz.bind(null, quiz.id)}>
          <div className="grid gap-5 sm:grid-cols-3">
            <Input label="Pass mark (%)" name="passPercent" type="number" min={1} max={100} defaultValue={quiz.passPercent} required />
            <Input label="Attempts allowed" name="maxAttempts" type="number" min={1} max={20} defaultValue={quiz.maxAttempts ?? ""} placeholder="Unlimited" />
            <Input label="Time limit (minutes)" name="timeLimitMinutes" type="number" min={1} max={180} defaultValue={quiz.timeLimitMinutes ?? ""} placeholder="None" />
          </div>
          <Checkbox label="Students must pass this quiz to complete the lesson" name="requiredToComplete" defaultChecked={quiz.requiredToComplete} hint="Passing marks the lesson complete automatically. When off, the quiz is optional practice." />
          <Checkbox label="Shuffle the question order for each attempt" name="shuffle" defaultChecked={quiz.shuffle} />
          <div><SubmitButton>Save quiz settings</SubmitButton></div>
        </ActionForm>
      </Card>

      <Card title={`Questions (${questions.length})`}>
        {questions.length ? (
          <ol className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <li key={q.id} className="rounded-[5px] border border-edge">
                <details>
                  <summary className="flex cursor-pointer items-start gap-3 px-4 py-3">
                    <span className="font-mono text-sm text-muted">{i + 1}</span>
                    <span className="flex min-w-0 grow flex-col gap-1.5">
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">{q.prompt} <Badge>{KIND_LABEL[q.kind]}</Badge></span>
                      <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {q.options.map((o, j) => <span key={j} className={q.correct.includes(j) ? "flex items-center gap-1 font-semibold text-emerald-700" : "text-muted"}>{q.correct.includes(j) && <CheckIcon className="size-3.5" />}{o}</span>)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-accent">Edit</span>
                  </summary>
                  <div className="flex flex-col gap-4 border-t border-line p-4">
                    <QuestionForm action={saveQuestion.bind(null, quiz.id, q.id)} question={q} submitLabel="Save question" />
                    <div className="flex justify-end"><DeleteButton action={deleteQuestion.bind(null, q.id)} label="Delete question" /></div>
                  </div>
                </details>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-muted">No questions yet. Students only see the quiz once it has at least one.</p>}
      </Card>

      {ai && (
        <Card title="Generate questions with AI">
          <ActionForm action={generateQuestions.bind(null, quiz.id)} className="flex flex-wrap items-end gap-3">
            <Select label="How many" name="count" defaultValue="5" options={[3, 5, 8, 10].map((n) => ({ value: String(n), label: String(n) }))} className="w-28" />
            <SubmitButton pendingText="Writing questions…"><SparkIcon className="size-4" /> Generate from lesson content</SubmitButton>
          </ActionForm>
          <p className="mt-3 text-xs text-muted">Questions are written from this lesson&apos;s written content and added to the list above for you to check and edit.</p>
        </Card>
      )}

      <Card title="Add a question">
        <QuestionForm action={saveQuestion.bind(null, quiz.id, null)} submitLabel="Add question" />
      </Card>
    </div>
  );
}
