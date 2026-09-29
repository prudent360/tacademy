"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, Textarea } from "@/components/forms";
import type { QuestionKind, QuizQuestion } from "@/db/schema";
import type { FormState } from "@/lib/validation";

const KINDS: { value: QuestionKind; label: string }[] = [
  { value: "single", label: "One correct answer" },
  { value: "multiple", label: "Select all that apply" },
  { value: "truefalse", label: "True or false" },
];

const input = "h-10 min-w-0 grow rounded-[5px] border border-edge-strong bg-white px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

/** Adds or edits one question. Options left blank are dropped when saved. */
export function QuestionForm({ action, question, submitLabel }: { action: (state: FormState, formData: FormData) => Promise<FormState>; question?: QuizQuestion; submitLabel: string }) {
  const [kind, setKind] = useState<QuestionKind>(question?.kind ?? "single");
  const options = Array.from({ length: 6 }, (_, i) => question?.options[i] ?? "");
  return (
    <ActionForm action={action} resetOnSuccess={!question}>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink">Question type</legend>
        {KINDS.map((k) => (
          <label key={k.value} className={`flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold ${kind === k.value ? "border-accent bg-accent-soft text-accent" : "border-edge-strong text-body"}`}>
            <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />{k.label}
          </label>
        ))}
      </fieldset>
      <Textarea label={kind === "truefalse" ? "Statement" : "Question"} name="prompt" defaultValue={question?.prompt} rows={2} required maxLength={1000} />
      {kind === "truefalse" ? (
        <fieldset className="flex gap-2">
          <legend className="mb-2 text-sm font-semibold text-ink">The statement is</legend>
          {(["true", "false"] as const).map((v) => (
            <label key={v} className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-edge-strong px-3 text-sm font-semibold text-body has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
              <input type="radio" name="truth" value={v} defaultChecked={question ? (v === "false") === (question.correct[0] === 1) : v === "true"} className="accent-accent" />{v === "true" ? "True" : "False"}
            </label>
          ))}
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-ink">Answers <span className="font-normal text-muted">({kind === "multiple" ? "tick every correct answer" : "choose the correct answer"}; leave extras blank)</span></legend>
          {options.map((text, i) => (
            <div key={`${kind}-${i}`} className="flex items-center gap-2.5">
              <input type={kind === "multiple" ? "checkbox" : "radio"} name="correct" value={i} defaultChecked={question?.kind !== "truefalse" && question?.correct.includes(i)} aria-label={`Option ${i + 1} is correct`} className="size-4 shrink-0 accent-emerald-600" />
              <input name={`option-${i}`} defaultValue={text} maxLength={300} placeholder={i < 2 ? `Option ${i + 1}` : `Option ${i + 1} (optional)`} className={input} />
            </div>
          ))}
        </fieldset>
      )}
      <Textarea label="Explanation (optional)" name="explanation" defaultValue={question?.explanation} rows={2} maxLength={1000} hint="Shown after the student answers, to help them learn." />
      <div><SubmitButton>{submitLabel}</SubmitButton></div>
    </ActionForm>
  );
}
