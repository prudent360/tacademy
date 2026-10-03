import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resetTemplate, saveTemplate, sendTestEmail } from "@/app/actions/admin";
import { ActionButton, ActionForm, Input, SubmitButton, Textarea } from "@/components/forms";
import { Card, Notice, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getTemplate, renderEmail } from "@/lib/email";
import { COMMON_VARIABLES, EMAIL_TEMPLATES, isTemplateKey } from "@/lib/email-templates";
import { draftEmailTemplate } from "@/app/actions/ai";
import { AiDraftButton } from "@/components/ai/draft-button";
import { aiAvailable } from "@/lib/ai";

export const metadata: Metadata = { title: "Edit email" };

export default async function EditEmailPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ reset?: string }> }) {
  const [{ key }, { reset }, admin] = await Promise.all([params, searchParams, requirePermission("emails.manage")]);
  if (!isTemplateKey(key)) notFound();
  const def = EMAIL_TEMPLATES[key];
  const current = await getTemplate(key);
  const preview = await renderEmail(current, { ...COMMON_VARIABLES, ...def.variables });
  const variables = { ...COMMON_VARIABLES, ...def.variables };
  const aiWriting = await aiAvailable("writing");

  return (
    <>
      <PageHeader back={{ href: "/admin/settings?tab=templates", label: "Email templates" }} title={def.name} description={def.description} actions={<ActionButton action={sendTestEmail.bind(null, key)} pendingText="Sending…" doneText={`Sent to ${admin.email}`}>Send test to me</ActionButton>} />
      {reset && <Notice>Restored the original wording.</Notice>}
      <div className="grid items-start gap-6 2xl:grid-cols-2">
        <Card title="Content">
          <ActionForm action={saveTemplate.bind(null, key)}>
            <Input label="Subject" name="subject" defaultValue={current.subject} required />
            <Textarea label="Body" name="body" defaultValue={current.body} rows={16} required />
            {aiWriting && <AiDraftButton draft={draftEmailTemplate.bind(null, key)} label="Improve wording with AI" />}
            <div className="rounded-lg border border-edge bg-panel p-4 text-[13px] leading-relaxed text-body">
              <p className="mb-2 font-semibold text-ink">How to write templates</p>
              <p>Markdown formatting: <code>**bold**</code>, <code>- list item</code>, <code>[link text](https://…)</code>.</p>
              <p>A button: put <code>[[Button label|{"{{url}}"}]]</code> on its own line.</p>
              <p className="mt-2">Available values:</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {Object.keys(variables).map((v) => <li key={v}><code className="rounded bg-surface px-1.5 py-0.5 text-accent-ink">{`{{${v}}}`}</code></li>)}
              </ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SubmitButton>Save template</SubmitButton>
              {current.customised && <ActionButton action={resetTemplate.bind(null, key)} variant="danger" pendingText="Restoring…">Restore original</ActionButton>}
            </div>
          </ActionForm>
        </Card>
        <div id="preview" className="scroll-mt-24"><Card title="Preview">
          <p className="mb-3 text-sm text-muted"><span className="font-semibold text-ink">Subject:</span> {preview.subject}</p>
          <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="h-[640px] w-full rounded-lg border border-edge bg-page" />
          <p className="mt-2 text-xs text-muted">Shown with sample values. Save to refresh the preview.</p>
        </Card></div>
      </div>
    </>
  );
}
