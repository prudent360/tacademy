import { ActionForm, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { COMMUNITY_CATEGORIES, type CommunityCategory } from "@/db/schema";
import { COMMUNITY_CATEGORY_INFO } from "@/lib/community";
import type { FormState } from "@/lib/validation";

/** Writing or editing a community post. */
export function CommunityPostForm({ action, initial, submitLabel }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: { title: string; category: CommunityCategory; body: string };
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      <Input label="Title" name="title" required maxLength={150} defaultValue={initial?.title} placeholder="e.g. How do I join three tables without duplicate rows?" />
      <Select
        label="Topic"
        name="category"
        defaultValue={initial?.category ?? "general"}
        options={COMMUNITY_CATEGORIES.map((c) => ({ value: c, label: `${COMMUNITY_CATEGORY_INFO[c].label}: ${COMMUNITY_CATEGORY_INFO[c].hint}` }))}
      />
      <Textarea label="Post" name="body" required rows={10} maxLength={10000} defaultValue={initial?.body} hint="Markdown works: **bold**, `code`, ```sql blocks```, lists and links. Be kind, and don't share answers to graded work." />
      <SubmitButton pendingText="Posting…">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
