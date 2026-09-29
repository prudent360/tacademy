"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { submitApplication, type ApplicationState } from "@/app/actions/applications";
import { PhoneInput } from "@/components/phone-input";
import { CURRENT_STATUSES, EXPERIENCE_LEVELS, HEARD_FROM, HOURS_PER_WEEK, MOTIVATION_MAX, STUDY_MODES } from "@/lib/applications";
import { COUNTRIES, countryByCode, flag } from "@/lib/countries";
import { QUALIFICATIONS } from "@/lib/utils";

export type ApplicationIntake = { id: number; label: string };

const input = "h-12 w-full rounded-[5px] border border-edge-strong bg-white px-3.5 text-[15px] text-ink transition placeholder:text-[#8b8598] hover:border-accent-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

function Field({ label, htmlFor, required, hint, children }: { label: string; htmlFor?: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}</label>
      {children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5 border-t border-line pt-7 first:border-t-0 first:pt-0">
      <legend className="mb-1 font-display text-lg font-bold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function Pills({ name, options, required }: { name: string; options: readonly { value: string; label: string }[]; required?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.value} className="flex h-10 cursor-pointer items-center rounded-[8px] border border-edge-strong px-4 text-sm font-semibold text-body transition hover:border-accent-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
          <input type="radio" name={name} value={o.value} required={required} className="sr-only" />{o.label}
        </label>
      ))}
    </div>
  );
}

/** The internship application form. Validation happens on the server; the browser's checks are just a head start. */
export function ApplicationForm({ programmes, intakes, defaultCountry }: { programmes: string[]; intakes: ApplicationIntake[]; defaultCountry?: string }) {
  const id = useId();
  const [state, action, pending] = useActionState<ApplicationState, FormData>(submitApplication, undefined);
  const [country, setCountry] = useState(countryByCode(defaultCountry)?.code ?? "");
  const [phoneCountry, setPhoneCountry] = useState(country || "NG");
  const [motivation, setMotivation] = useState("");

  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-8 rounded-[24px] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,.45)] sm:p-10">
      {/* Left empty by people; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      <Section title="About you">
        <Field label="Full name" htmlFor={`${id}-name`} required><input id={`${id}-name`} name="name" required maxLength={120} autoComplete="name" className={input} /></Field>
        <Field label="Email address" htmlFor={`${id}-email`} required><input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" className={input} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Country" htmlFor={`${id}-country`} required>
            <select id={`${id}-country`} name="country" required value={country} onChange={(e) => { setCountry(e.target.value); if (countryByCode(e.target.value)) setPhoneCountry(e.target.value); }} className={`${input} cursor-pointer`}>
              <option value="">Select your country</option>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{flag(c.code)} {c.name}</option>)}
            </select>
          </Field>
          <Field label="City" htmlFor={`${id}-city`} required><input id={`${id}-city`} name="city" required maxLength={80} autoComplete="address-level2" className={input} /></Field>
        </div>
        <Field label="Phone number (WhatsApp preferred)" htmlFor={`${id}-phone`} required>
          <PhoneInput id={`${id}-phone`} country={phoneCountry} onCountryChange={setPhoneCountry} />
        </Field>
      </Section>

      <Section title="Your background">
        <Field label="Have you completed a course with us?" required hint="Graduates of our courses can join eligible internships for free. We check this against our records.">
          <Pills name="graduateClaimed" required options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Highest qualification" htmlFor={`${id}-qual`}>
            <select id={`${id}-qual`} name="qualification" defaultValue="" className={`${input} cursor-pointer`}>
              <option value="">Select an option</option>
              {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </Field>
          <Field label="What are you doing at the moment?" htmlFor={`${id}-status`} required>
            <select id={`${id}-status`} name="currentStatus" required defaultValue="" className={`${input} cursor-pointer`}>
              <option value="" disabled>Select an option</option>
              {CURRENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="What you'd like to do">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Internship area" htmlFor={`${id}-area`} required>
            <select id={`${id}-area`} name="skillArea" required defaultValue={programmes.length === 1 ? programmes[0] : ""} className={`${input} cursor-pointer`}>
              <option value="" disabled>Select an area</option>
              {programmes.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="Not sure yet">Not sure yet</option>
            </select>
          </Field>
          <Field label="Your experience in this area" htmlFor={`${id}-exp`} required>
            <select id={`${id}-exp`} name="experience" required defaultValue="" className={`${input} cursor-pointer`}>
              <option value="" disabled>Select a level</option>
              {EXPERIENCE_LEVELS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
        </div>
        {intakes.length > 0 && (
          <Field label="Preferred intake" htmlFor={`${id}-intake`}>
            <select id={`${id}-intake`} name="preferredCohortId" defaultValue="" className={`${input} cursor-pointer`}>
              <option value="">Not sure yet</option>
              {intakes.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
          </Field>
        )}
      </Section>

      <Section title="Your work">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Portfolio, GitHub or project link" htmlFor={`${id}-portfolio`}><input id={`${id}-portfolio`} name="portfolioUrl" type="url" maxLength={500} placeholder="https://" className={input} /></Field>
          <Field label="LinkedIn profile" htmlFor={`${id}-linkedin`}><input id={`${id}-linkedin`} name="linkedinUrl" type="url" maxLength={500} placeholder="https://www.linkedin.com/in/…" className={input} /></Field>
        </div>
        <Field label="CV (optional)" htmlFor={`${id}-cv`} hint="PDF or Word, up to 4 MB.">
          <input id={`${id}-cv`} name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf" className="text-sm text-body file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent-soft file:px-4 file:font-semibold file:text-accent" />
        </Field>
      </Section>

      <Section title="Availability">
        <Field label="How would you like to work?" required><Pills name="mode" required options={STUDY_MODES} /></Field>
        <Field label="Hours a week you can commit" required><Pills name="hoursPerWeek" required options={HOURS_PER_WEEK.map((h) => ({ value: h, label: h }))} /></Field>
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-ink">Do you have…</span>
          <label className="flex cursor-pointer items-center gap-3 text-[15px] text-body"><input type="checkbox" name="hasLaptop" className="size-5 accent-accent" /> A laptop or computer you can use</label>
          <label className="flex cursor-pointer items-center gap-3 text-[15px] text-body"><input type="checkbox" name="hasInternet" className="size-5 accent-accent" /> Reliable internet access</label>
        </div>
      </Section>

      <Section title="Why us?">
        <Field label="Why do you want to join, and what do you hope to achieve?" htmlFor={`${id}-why`} required>
          <textarea id={`${id}-why`} name="motivation" required minLength={30} maxLength={MOTIVATION_MAX} rows={5} value={motivation} onChange={(e) => setMotivation(e.target.value)} className="w-full rounded-[5px] border border-edge-strong bg-white px-3.5 py-3 text-[15px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
          <p className={`text-right text-xs ${motivation.length > MOTIVATION_MAX - 50 ? "text-amber-800" : "text-muted"}`}>{motivation.length}/{MOTIVATION_MAX}</p>
        </Field>
        <Field label="How did you hear about us?" htmlFor={`${id}-heard`}>
          <select id={`${id}-heard`} name="heardFrom" defaultValue="" className={`${input} cursor-pointer`}>
            <option value="">Select an option</option>
            {HEARD_FROM.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </Field>
      </Section>

      <div className="flex flex-col gap-3 border-t border-line pt-7">
        <label className="flex cursor-pointer items-start gap-3 text-[15px] text-body"><input type="checkbox" name="isAdult" required className="mt-0.5 size-5 shrink-0 accent-accent" /> I&apos;m 18 or older.</label>
        <label className="flex cursor-pointer items-start gap-3 text-[15px] text-body"><input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-accent" /> <span>I agree to the <Link href="/privacy" target="_blank" className="font-semibold text-accent underline">privacy policy</Link> and to being contacted about my application.</span></label>
      </div>

      <div aria-live="polite" className="empty:hidden">{!pending && state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}</div>
      <button type="submit" disabled={pending} className="flex h-13 w-full cursor-pointer items-center justify-center rounded-[8px] bg-accent text-[16px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(113,52,217,.9)] transition hover:bg-accent-dark disabled:cursor-wait disabled:opacity-70">
        {pending ? "Sending your application…" : "Submit application"}
      </button>
    </form>
  );
}
