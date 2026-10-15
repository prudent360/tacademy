import { ActionForm, Checkbox, FileField, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import type { Programme } from "@/db/schema";
import { CURRENCIES, toMajorInput } from "@/lib/money";
import type { FormState } from "@/lib/validation";
import { RichTextEditor } from "@/components/rich-text-editor";

/** Create or edit a programme: a named bundle of courses with its own duration and fee. */
export function ProgrammeForm({ action, programme, courses, included = [], currencies }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  programme?: Programme;
  /** Every regular course that can be added. */
  courses: { id: number; title: string; published: boolean; durationWeeks: number | null }[];
  /** Course ids already in the programme, in order. */
  included?: number[];
  /** The academy's currencies (Settings), plus any the programme already has a fee in. */
  currencies: string[];
}) {
  const shown = CURRENCIES.filter((c) => currencies.includes(c.code) || (programme?.prices[c.code] ?? 0) > 0);
  // Courses already in the programme first, in their order, then the rest.
  const sorted = [...courses].sort((a, b) => {
    const ia = included.indexOf(a.id), ib = included.indexOf(b.id);
    return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
  });
  return (
    <ActionForm action={action}>
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Programme name" name="title" defaultValue={programme?.title} required placeholder="e.g. Data Analytics Career Programme" />
        <Input label="Web address" name="slug" defaultValue={programme?.slug} hint="Leave empty to generate from the name." />
      </div>
      <Textarea label="Summary" name="summary" defaultValue={programme?.summary} rows={2} required hint="One or two sentences for programme cards and search results." />
      <fieldset className="flex flex-col gap-3 rounded-[5px] border border-edge bg-panel p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Courses in this programme</legend>
        <p className="text-[13px] text-muted">Tick at least two courses. Use <strong className="text-ink">Order</strong> to set the sequence students take them in (1 first); without numbers they keep the order shown. Students still join each course&apos;s cohorts.</p>
        {courses.length ? (
          <ul className="flex flex-col gap-2">
            {sorted.map((c) => {
              const at = included.indexOf(c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-lg border border-edge bg-surface px-3.5 py-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                  <label className="flex min-w-0 grow cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
                    <input type="checkbox" name="courseIds" value={c.id} defaultChecked={at >= 0} className="size-4 shrink-0 accent-accent" />
                    <span className="min-w-0 truncate">{c.title}</span>
                    {c.durationWeeks && <span className="shrink-0 text-xs font-normal text-muted">{c.durationWeeks} wks</span>}
                    {!c.published && <span className="shrink-0 text-xs font-normal text-amber-700">Draft</span>}
                  </label>
                  <input type="number" name={`position-${c.id}`} min={1} max={99} defaultValue={at >= 0 ? at + 1 : ""} aria-label={`Order of ${c.title}`} placeholder="Order" className="h-9 w-20 shrink-0 rounded-md border border-edge bg-white px-2 text-sm" />
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-muted">No courses yet. Create courses first, then bundle them into a programme.</p>}
      </fieldset>
      <div className="grid gap-5 md:grid-cols-4">
        <Input label="Duration" name="duration" defaultValue={programme?.duration} required placeholder="e.g. 6 months" hint="As students should read it." />
        <Input label="Category" name="category" defaultValue={programme?.category} placeholder="Data" />
        <Select label="Level" name="level" defaultValue={programme?.level ?? "Beginner"} options={["Beginner", "Intermediate", "Advanced", "All levels"].map((v) => ({ value: v, label: v }))} />
        <Input label="Sort order" name="sortOrder" type="number" defaultValue={programme?.sortOrder ?? 0} hint="Lower shows first." />
      </div>
      <fieldset className="flex flex-col gap-3 rounded-[5px] border border-edge bg-panel p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Programme fee</legend>
        <p className="text-[13px] text-muted">The price for the whole programme in each currency you offer. Where every course also has a price in that currency, the page shows how much students save against taking the courses separately. Leave empty to show “Contact us for fees”.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((c) => <Input key={c.code} label={c.code} name={`price-${c.code}`} inputMode="decimal" placeholder="0" defaultValue={toMajorInput(programme?.prices[c.code])} hint={c.name} />)}
        </div>
        <Input label="Fee note (optional)" name="feeNote" defaultValue={programme?.feeNote} maxLength={200} placeholder="e.g. Pay in 3 monthly instalments" />
      </fieldset>
      <RichTextEditor label="Full description" name="description" defaultValue={programme?.description} minHeight={240} placeholder="Who the programme is for, how the courses build on each other and where it leads." hint="Shown on the programme page." />
      <div className="grid gap-5 md:grid-cols-2">
        <Textarea label="What students will be able to do" name="outcomes" defaultValue={programme?.outcomes.join("\n")} rows={5} hint="One per line." />
        <Textarea label="Relevant job roles" name="jobRoles" defaultValue={programme?.jobRoles.join("\n")} rows={5} hint="One role per line." />
      </div>
      <FileField label="Cover image" name="image" current={programme?.imageUrl} removeName="removeImage" hint="Used on programme cards and in the page hero. 16:9 works best. Without one, generated artwork is used." />
      <FileField label="Hero background photo" name="heroImage" current={programme?.heroImageUrl} removeName="removeHeroImage" hint="Optional. Fills the top of the programme page behind the title. Use a wide landscape photo, at least 1600px across." />
      <fieldset className="flex flex-col gap-4 rounded-[5px] border border-edge bg-panel p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Search engines</legend>
        <Input label="Search title" name="seoTitle" defaultValue={programme?.seoTitle} maxLength={70} placeholder={programme?.title} hint="Optional. Uses the programme name when empty." />
        <Textarea label="Meta description" name="seoDescription" defaultValue={programme?.seoDescription} rows={2} maxLength={200} placeholder={programme?.summary} hint="Optional. Uses the summary when empty." />
      </fieldset>
      <Checkbox label="Published" name="published" defaultChecked={programme?.published ?? false} hint="Visible on the website under Programmes." />
      <SubmitButton>{programme ? "Save programme" : "Create programme"}</SubmitButton>
    </ActionForm>
  );
}
