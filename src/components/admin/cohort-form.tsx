import { ActionForm, Checkbox, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import type { Cohort, User } from "@/db/schema";
import { CURRENCIES, toMajorInput } from "@/lib/money";
import type { FormState } from "@/lib/validation";

export function CohortForm({ action, cohort, instructors, assigned, currencies }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  cohort?: Cohort;
  instructors: Pick<User, "id" | "name" | "email" | "role">[];
  assigned: number[];
  currencies: string[];
}) {
  const shown = CURRENCIES.filter((c) => currencies.includes(c.code) || (cohort?.prices[c.code] ?? 0) > 0);
  return (
    <ActionForm action={action}>
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Cohort name" name="name" defaultValue={cohort?.name} placeholder="October 2026" required />
        <Select label="Format" name="deliveryMode" defaultValue={cohort?.deliveryMode ?? "virtual"} options={[{ value: "virtual", label: "Live online" }, { value: "physical", label: "In person" }, { value: "hybrid", label: "Hybrid (online and in person)" }]} />
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <Input label="Start date" name="startDate" type="date" defaultValue={cohort?.startDate ?? ""} />
        <Input label="End date" name="endDate" type="date" defaultValue={cohort?.endDate ?? ""} />
        <Input label="Capacity" name="capacity" type="number" min={1} defaultValue={cohort?.capacity ?? ""} hint="Leave empty for unlimited." />
      </div>
      <Input label="Schedule summary" name="schedule" defaultValue={cohort?.schedule} placeholder="Tue & Thu 6–8pm online · Sat 10am–1pm in person" />
      <Textarea label="Venue" name="venue" defaultValue={cohort?.venue} rows={2} hint="Required for in-person and hybrid cohorts; used as the default for in-person classes." />
      <fieldset className="flex flex-col gap-3 rounded-lg border border-edge bg-panel p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Price</legend>
        <p className="text-[13px] text-muted">Set a price in each currency you accept. Students choose the currency at checkout: GBP/USD/EUR/CAD are charged via Stripe, NGN/GHS/KES/ZAR via Paystack. Leave every price empty to make the cohort free.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((c) => (
            <Input key={c.code} label={c.code} name={`price-${c.code}`} inputMode="decimal" placeholder="0" defaultValue={toMajorInput(cohort?.prices[c.code])} hint={c.name} />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-lg border border-edge bg-panel p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Registration fee</legend>
        <p className="text-[13px] text-muted">Optional one-off fee added to the student&apos;s first payment, on top of tuition. Discount codes don&apos;t apply to it.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((c) => (
            <Input key={c.code} label={c.code} name={`regfee-${c.code}`} inputMode="decimal" placeholder="0" defaultValue={toMajorInput(cohort?.registrationFees[c.code])} />
          ))}
        </div>
        <Checkbox label="Let students pay only the registration fee at enrolment" name="registrationOnly" defaultChecked={cohort?.registrationOnly ?? false} hint="Their place is secured and the tuition is paid later from their dashboard." />
      </fieldset>
      <Input label="Instalment deposit (%)" name="depositPercent" type="number" min={10} max={90} defaultValue={cohort?.depositPercent ?? ""} hint="Optional. Students can pay this percentage now and the balance later." />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold text-ink">Instructors</legend>
        {instructors.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {instructors.map((i) => (
              <label key={i.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-edge px-3.5 py-2.5 hover:bg-panel">
                <input type="checkbox" name="instructorIds" value={i.id} defaultChecked={assigned.includes(i.id)} className="size-5 accent-accent" />
                <span className="flex min-w-0 flex-col"><span className="text-sm font-semibold text-ink">{i.name}</span><span className="truncate text-xs text-muted">{i.email}{i.role === "admin" ? " · admin" : ""}</span></span>
              </label>
            ))}
          </div>
        ) : <p className="text-sm text-muted">No instructors yet. Invite one under People.</p>}
      </fieldset>
      <Checkbox label="Enrolment open" name="enrollmentOpen" defaultChecked={cohort?.enrollmentOpen ?? true} />
      <SubmitButton>{cohort ? "Save cohort" : "Create cohort"}</SubmitButton>
    </ActionForm>
  );
}
