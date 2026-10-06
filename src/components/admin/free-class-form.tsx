import { saveFreeClass } from "@/app/actions/free-classes";
import { ActionForm, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import type { FreeClass } from "@/db/schema";
import { toZonedInput } from "@/lib/time";

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

/** Create or edit a free taster class. */
export function FreeClassForm({ freeClass: fc, courses, timezone }: { freeClass?: FreeClass; courses: { id: number; title: string }[]; timezone: string }) {
  return (
    <ActionForm action={saveFreeClass.bind(null, fc?.id ?? null)} className="flex flex-col gap-6">
      <Fieldset title="The class">
        <Input label="Title" name="title" defaultValue={fc?.title} required maxLength={120} placeholder="e.g. Your first Power BI dashboard in 90 minutes" />
        <Textarea label="Short summary" name="summary" defaultValue={fc?.summary} required rows={2} maxLength={300} hint="One or two sentences, shown on the Free classes list." />
        <Textarea label="Description" name="description" defaultValue={fc?.description} rows={6} hint="Leave a blank line between paragraphs; start a line with “- ” for a bullet; wrap words in **double stars** for bold." />
        <Textarea label="What they'll learn" name="takeaways" defaultValue={(fc?.takeaways ?? []).join("\n")} rows={4} hint="One per line, up to 8. Shown as a checklist." />
        <div className="grid gap-5 md:grid-cols-2">
          <Input label="Host" name="hostName" defaultValue={fc?.hostName} maxLength={80} placeholder="e.g. Tolu Adeyemi" />
          <Input label="Host's role" name="hostTitle" defaultValue={fc?.hostTitle} maxLength={120} placeholder="e.g. Lead instructor, Data Analytics" />
        </div>
      </Fieldset>

      <Fieldset title="When and where" hint={`Times are in the academy's time zone (${timezone}).`}>
        <div className="grid gap-5 md:grid-cols-2">
          <Input label="Starts" name="startsAt" type="datetime-local" required defaultValue={toZonedInput(fc?.startsAt, timezone)} />
          <Input label="Ends" name="endsAt" type="datetime-local" required defaultValue={toZonedInput(fc?.endsAt, timezone)} />
        </div>
        <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
          <Select label="Format" name="mode" defaultValue={fc?.mode ?? "virtual"} options={[{ value: "virtual", label: "Live online" }, { value: "physical", label: "In person" }]} />
          <Input label="Meeting link (online)" name="meetingUrl" type="url" defaultValue={fc?.meetingUrl ?? ""} maxLength={500} placeholder="https://meet.google.com/…" hint="Only sent to people who sign up." />
        </div>
        <Input label="Venue (in person)" name="venue" defaultValue={fc?.venue} maxLength={300} placeholder="Full address" />
        <Input label="Places (optional)" name="capacity" inputMode="numeric" defaultValue={fc?.capacity ?? ""} placeholder="No limit" hint="Sign-ups close when it's full." />
      </Fieldset>

      <Fieldset title="Follow-up offer" hint="An hour after the class ends, everyone who signed up gets a thank-you email with the recording (if added) and a personal, single-use discount code for the course below.">
        <Select label="Course it leads into" name="courseId" defaultValue={String(fc?.courseId ?? "")} options={[{ value: "", label: "No course (no discount code)" }, ...courses.map((c) => ({ value: String(c.id), label: c.title }))]} />
        <div className="grid gap-5 md:grid-cols-2">
          <Input label="Discount (%)" name="offerPercent" type="number" min={0} max={100} defaultValue={fc?.offerPercent ?? 10} hint="0 sends the thank-you without a code." />
          <Input label="Code valid for (days)" name="offerDays" type="number" min={1} max={90} defaultValue={fc?.offerDays ?? 7} />
        </div>
        <Input label="Recording link (optional)" name="recordingUrl" type="url" defaultValue={fc?.recordingUrl ?? ""} maxLength={500} placeholder="https://…" hint="Add it before the follow-up goes out to include it." />
      </Fieldset>

      <Fieldset title="Publishing">
        <div className="grid gap-5 md:grid-cols-2">
          <Select label="Status" name="status" defaultValue={fc?.status ?? "draft"} options={[{ value: "draft", label: "Draft (only the team sees it)" }, { value: "open", label: "Open (live, taking sign-ups)" }, { value: "closed", label: "Closed (shown, no new sign-ups)" }]} />
          <Input label="Web address" name="slug" defaultValue={fc?.slug} maxLength={80} placeholder="Made from the title" hint="free-classes/… Leave empty to make it from the title." />
        </div>
      </Fieldset>

      <div><SubmitButton>{fc ? "Save changes" : "Create class"}</SubmitButton></div>
    </ActionForm>
  );
}
