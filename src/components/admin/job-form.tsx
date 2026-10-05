import { saveJob } from "@/app/actions/careers";
import { ActionForm, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { JOB_MODES, JOB_TYPES, type JobOpening } from "@/db/schema";
import { JOB_MODE_LABEL, JOB_TYPE_LABEL } from "@/lib/careers";

function Fieldset({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-5 rounded-[5px] border border-edge bg-surface p-5 md:p-6">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </fieldset>
  );
}

/** Create or edit a role on the Careers page. */
export function JobForm({ job, departments }: { job?: JobOpening; departments: string[] }) {
  const lines = (list?: string[]) => (list ?? []).join("\n");
  return (
    <ActionForm action={saveJob.bind(null, job?.id ?? null)} className="flex flex-col gap-6">
      <Fieldset title="The role">
        <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
          <Input label="Job title" name="title" defaultValue={job?.title} required maxLength={120} placeholder="e.g. Programme Coordinator" />
          <Input label="Team or department" name="department" defaultValue={job?.department} maxLength={60} placeholder="e.g. Operations" list="job-departments" />
          <datalist id="job-departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Select label="Type" name="employmentType" defaultValue={job?.employmentType ?? "full_time"} options={JOB_TYPES.map((t) => ({ value: t, label: JOB_TYPE_LABEL[t] }))} />
          <Select label="Where" name="workMode" defaultValue={job?.workMode ?? "remote"} options={JOB_MODES.map((m) => ({ value: m, label: JOB_MODE_LABEL[m] }))} />
          <Input label="Location" name="location" defaultValue={job?.location} maxLength={80} placeholder="e.g. Lagos, Nigeria" hint="City or region. Leave empty for fully remote." />
        </div>
        <Input label="Pay (optional)" name="salary" defaultValue={job?.salary} maxLength={120} placeholder="e.g. ₦400,000 – ₦600,000 a month" hint="Shown as you write it. Roles that show pay get more applicants." />
        <Textarea label="Short summary" name="summary" defaultValue={job?.summary} required rows={2} maxLength={300} hint="One or two sentences, shown on the Careers list." />
      </Fieldset>

      <Fieldset title="Description" hint="Write naturally. Leave a blank line between paragraphs; start a line with “- ” for a bullet point; wrap words in **double stars** for bold.">
        <Textarea label="About the role" name="description" defaultValue={job?.description} rows={8} />
        <div className="grid gap-5 md:grid-cols-2">
          <Textarea label="What you'll do" name="responsibilities" defaultValue={lines(job?.responsibilities)} rows={6} hint="One per line." />
          <Textarea label="What we're looking for" name="requirements" defaultValue={lines(job?.requirements)} rows={6} hint="One per line." />
          <Textarea label="Nice to have" name="niceToHave" defaultValue={lines(job?.niceToHave)} rows={4} hint="One per line. Optional." />
          <Textarea label="What we offer" name="benefits" defaultValue={lines(job?.benefits)} rows={4} hint="One per line. Optional." />
        </div>
      </Fieldset>

      <Fieldset title="Applications">
        <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
          <Select label="How people apply" name="applyMethod" defaultValue={job?.applyMethod ?? "form"} options={[{ value: "form", label: "Application form on this site" }, { value: "email", label: "By email" }, { value: "link", label: "On another website" }]} />
          <Input label="Email or link (if not using the form)" name="applyTarget" defaultValue={job?.applyTarget} maxLength={500} placeholder="careers@tekskillup.com or https://…" hint="With the form, applications and CVs arrive under Careers › Applications." />
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Select label="Status" name="status" defaultValue={job?.status ?? "draft"} options={[{ value: "draft", label: "Draft (only the team sees it)" }, { value: "open", label: "Open (live on the Careers page)" }, { value: "closed", label: "Closed (shown as closed)" }]} />
          <Input label="Closing date (optional)" name="closesOn" type="date" defaultValue={job?.closesOn ?? ""} hint="Applications stop after this day." />
          <Input label="Sort order" name="sortOrder" type="number" defaultValue={job?.sortOrder ?? 0} hint="Lower shows first." />
        </div>
        <Input label="Web address" name="slug" defaultValue={job?.slug} maxLength={80} placeholder="Made from the title" hint="careers/… Leave empty to make it from the title." />
      </Fieldset>

      <div><SubmitButton>{job ? "Save changes" : "Create role"}</SubmitButton></div>
    </ActionForm>
  );
}
