"use client";

import { useState } from "react";
import { ActionForm, Input, SubmitButton } from "@/components/forms";
import type { FormState } from "@/lib/validation";
import type { AiDraft } from "@/app/actions/ai";
import { AiDraftButton } from "@/components/ai/draft-button";
import { RichTextEditor } from "@/components/rich-text-editor";

export function GradeForm({ action, maxScore, score, feedback, aiDraft }: { action: (state: FormState, formData: FormData) => Promise<FormState>; maxScore: number; score: number | null; feedback: string; aiDraft?: () => Promise<AiDraft> }) {
  const [decision, setDecision] = useState<"graded" | "resubmit">("graded");
  return (
    <ActionForm action={action}>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink">Outcome</legend>
        {([["graded", "Grade it"], ["resubmit", "Request changes"]] as const).map(([value, label]) => (
          <label key={value} className={`flex h-10 cursor-pointer items-center rounded-lg border px-4 text-sm font-semibold ${decision === value ? "border-accent bg-accent-soft text-accent-ink" : "border-edge-strong text-body"}`}>
            <input type="radio" name="decision" value={value} checked={decision === value} onChange={() => setDecision(value)} className="sr-only" />
            {label}
          </label>
        ))}
      </fieldset>
      {aiDraft && decision === "graded" && <AiDraftButton draft={aiDraft} label="Suggest a grade with AI" />}
      {decision === "graded" && <Input label={`Score (out of ${maxScore})`} name="score" type="number" min={0} max={maxScore} defaultValue={score ?? ""} required />}
      <RichTextEditor label={decision === "graded" ? "Feedback" : "What needs to change"} name="feedback" defaultValue={feedback} minHeight={200} hint="The student is emailed when you save." />
      <SubmitButton pendingText="Saving…">{decision === "graded" ? "Save grade and notify" : "Send back to student"}</SubmitButton>
    </ActionForm>
  );
}
