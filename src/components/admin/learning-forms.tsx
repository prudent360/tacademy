import { ActionForm, Checkbox, Input, SubmitButton, Textarea } from "@/components/forms";
import type { LearningModule, Lesson } from "@/db/schema";
import type { FormState } from "@/lib/validation";
import { RichTextEditor } from "@/components/rich-text-editor";
import { AiDraftButton } from "@/components/ai/draft-button";
import type { AiDraft } from "@/app/actions/ai";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** `cohortId` is set when an instructor works from a cohort, so they return to its Learning tab. */
export function ModuleForm({ action, module, cohortId }: { action: Action; module?: LearningModule; cohortId?: number }) {
  return (
    <ActionForm action={action}>
      {cohortId && <input type="hidden" name="cohort" value={cohortId} />}
      <Input label="Module title" name="title" defaultValue={module?.title} required />
      <Textarea label="Summary" name="summary" defaultValue={module?.summary} rows={3} hint="Tell students what they will learn in this module." />
      <Input label="Position" name="position" type="number" defaultValue={module?.position ?? 0} hint="Lower numbers appear first." />
      <Checkbox label="Published for students" name="published" defaultChecked={module?.published ?? false} hint="Lessons also need to be published before students can open them." />
      <SubmitButton>{module ? "Save module" : "Create module"}</SubmitButton>
    </ActionForm>
  );
}

/** `draft`, when AI writing is switched on, fills the summary and content from the title. */
export function LessonForm({ action, lesson, cohortId, draft }: { action: Action; lesson?: Lesson; cohortId?: number; draft?: (values: Record<string, string>) => Promise<AiDraft> }) {
  return (
    <ActionForm action={action}>
      {cohortId && <input type="hidden" name="cohort" value={cohortId} />}
      <Input label="Lesson title" name="title" defaultValue={lesson?.title} required />
      {draft && (
        <div className="-mt-2 flex flex-col gap-1.5">
          <AiDraftButton draft={draft} label="Draft this lesson with AI" confirmFields={["summary", "content"]} />
          <p className="text-xs text-muted">Writes the summary (unless you&apos;ve written one) and the lesson content from the title. Add a summary first to steer it. Nothing is saved until you click Save.</p>
        </div>
      )}
      <Textarea label="Summary" name="summary" defaultValue={lesson?.summary} rows={2} hint="A short description shown in the module outline." />
      <RichTextEditor label="Lesson content" name="content" defaultValue={lesson?.content} minHeight={360} placeholder="Write the lesson: explanations, steps, examples and code." hint="Students read this under the video. Quiz questions can be generated from it with AI." />
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Video link" name="videoUrl" type="url" defaultValue={lesson?.videoUrl ?? ""} placeholder="https://player.mediadelivery.net/embed/…" hint="Plays inside the lesson. Bunny Stream: open the video and copy its embed or play link. YouTube, Vimeo and Loom links work too." />
        <Input label="Resource link" name="resourceUrl" type="url" defaultValue={lesson?.resourceUrl ?? ""} placeholder="https://…" hint="A worksheet, slides, repository or further reading." />
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Input label="Resource label" name="resourceLabel" defaultValue={lesson?.resourceLabel} placeholder="Download worksheet" />
        <Input label="Estimated minutes" name="estimatedMinutes" type="number" min={1} max={600} defaultValue={lesson?.estimatedMinutes ?? 10} required />
        <Input label="Position" name="position" type="number" defaultValue={lesson?.position ?? 0} hint="Lower numbers appear first." />
      </div>
      <Checkbox label="Published for students" name="published" defaultChecked={lesson?.published ?? false} />
      <SubmitButton>{lesson ? "Save lesson" : "Create lesson"}</SubmitButton>
    </ActionForm>
  );
}
