import { ActionForm, Checkbox, Input, SubmitButton, Textarea } from "@/components/forms";
import type { LearningModule, Lesson } from "@/db/schema";
import type { FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function ModuleForm({ action, module }: { action: Action; module?: LearningModule }) {
  return (
    <ActionForm action={action}>
      <Input label="Module title" name="title" defaultValue={module?.title} required />
      <Textarea label="Summary" name="summary" defaultValue={module?.summary} rows={3} hint="Tell students what they will learn in this module." />
      <Input label="Position" name="position" type="number" defaultValue={module?.position ?? 0} hint="Lower numbers appear first." />
      <Checkbox label="Published for students" name="published" defaultChecked={module?.published ?? false} hint="Lessons also need to be published before students can open them." />
      <SubmitButton>{module ? "Save module" : "Create module"}</SubmitButton>
    </ActionForm>
  );
}

export function LessonForm({ action, lesson }: { action: Action; lesson?: Lesson }) {
  return (
    <ActionForm action={action}>
      <Input label="Lesson title" name="title" defaultValue={lesson?.title} required />
      <Textarea label="Summary" name="summary" defaultValue={lesson?.summary} rows={2} hint="A short description shown in the module outline." />
      <Textarea label="Lesson content" name="content" defaultValue={lesson?.content} rows={18} hint="Markdown supported: headings, lists, links, tables and code." />
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Video link" name="videoUrl" type="url" defaultValue={lesson?.videoUrl ?? ""} placeholder="https://…" hint="YouTube, Vimeo, Loom or another hosted video." />
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
