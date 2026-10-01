"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { submitInstructorApplication, type InstructorApplicationState } from "@/app/actions/instructor-applications";
import { PhoneInput } from "@/components/phone-input";
import { AVAILABILITY, HEARD_FROM, STUDY_MODES, TEACHING_EXPERIENCE, TOPICS_MAX, YEARS_EXPERIENCE } from "@/lib/applications";
import { COUNTRIES, countryByCode, flag } from "@/lib/countries";

const input = "h-12 w-full rounded-[5px] border border-edge-strong bg-white px-3.5 text-[15px] text-ink transition placeholder:text-[#878598] hover:border-accent-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

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
    // min-w-0: fieldsets otherwise refuse to shrink below their widest content, pushing fields out of the card on phones.
    <fieldset className="flex min-w-0 flex-col gap-5 border-t border-line pt-7 first:border-t-0 first:pt-0">
      <legend className="mb-1 font-display text-lg font-bold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function Pills({ name, options, required }: { name: string; options: readonly { value: string; label: string }[]; required?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.value} className="flex h-10 cursor-pointer items-center rounded-[5px] border border-edge-strong px-4 text-sm font-semibold text-body transition hover:border-accent-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
          <input type="radio" name={name} value={o.value} required={required} className="sr-only" />{o.label}
        </label>
      ))}
    </div>
  );
}

/** The "Become an instructor" application. Validation happens on the server; the browser's checks are a head start. */
export function InstructorApplicationForm({ subjects, defaultCountry }: { subjects: string[]; defaultCountry?: string }) {
  const id = useId();
  const [state, action, pending] = useActionState<InstructorApplicationState, FormData>(submitInstructorApplication, undefined);
  const [country, setCountry] = useState(countryByCode(defaultCountry)?.code ?? "");
  const [phoneCountry, setPhoneCountry] = useState(country || "NG");
  const [topics, setTopics] = useState("");

  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-8 rounded-[5px] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,.45)] sm:p-10">
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

      <Section title="Your expertise">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Current role" htmlFor={`${id}-role`} required hint="Your job title and where you work.">
            <input id={`${id}-role`} name="currentRole" required maxLength={160} placeholder="e.g. Senior Data Analyst at Acme" autoComplete="organization-title" className={input} />
          </Field>
          <Field label="Area you'd teach" htmlFor={`${id}-area`} required>
            <input id={`${id}-area`} name="expertise" required maxLength={160} list={`${id}-subjects`} placeholder="e.g. Data analysis with Power BI" className={input} />
            <datalist id={`${id}-subjects`}>{subjects.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
        </div>
        <Field label="Years working in this area" required><Pills name="yearsExperience" required options={YEARS_EXPERIENCE.map((y) => ({ value: y, label: y }))} /></Field>
        <Field label="Your teaching experience" htmlFor={`${id}-teaching`} required hint="Teaching experience is a bonus, not a requirement. We help new instructors get started.">
          <select id={`${id}-teaching`} name="teachingExperience" required defaultValue="" className={`${input} cursor-pointer`}>
            <option value="" disabled>Select an option</option>
            {TEACHING_EXPERIENCE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="LinkedIn profile" htmlFor={`${id}-linkedin`} required><input id={`${id}-linkedin`} name="linkedinUrl" type="url" required maxLength={500} placeholder="https://www.linkedin.com/in/…" className={input} /></Field>
          <Field label="Portfolio, GitHub or website" htmlFor={`${id}-portfolio`}><input id={`${id}-portfolio`} name="portfolioUrl" type="url" maxLength={500} placeholder="https://" className={input} /></Field>
        </div>
        <Field label="CV (optional)" htmlFor={`${id}-cv`} hint="PDF or Word, up to 4 MB.">
          <input id={`${id}-cv`} name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf" className="w-full min-w-0 max-w-full text-sm text-body file:mr-3 file:h-10 file:cursor-pointer file:rounded-[5px] file:border-0 file:bg-accent-soft file:px-4 file:font-semibold file:text-accent" />
        </Field>
      </Section>

      <Section title="Teaching with us">
        <Field label="What would you like to teach, and to whom?" htmlFor={`${id}-topics`} required hint="An existing course of ours, or something new you'd like to propose. Mention the level (beginners, professionals…).">
          <textarea id={`${id}-topics`} name="topics" required minLength={30} maxLength={TOPICS_MAX} rows={5} value={topics} onChange={(e) => setTopics(e.target.value)} className="w-full rounded-[5px] border border-edge-strong bg-white px-3.5 py-3 text-[15px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
          <p className={`text-right text-xs ${topics.length > TOPICS_MAX - 50 ? "text-amber-800" : "text-muted"}`}>{topics.length}/{TOPICS_MAX}</p>
        </Field>
        <Field label="How would you like to teach?" required><Pills name="mode" required options={STUDY_MODES.map((m) => ({ value: m.value, label: m.value === "remote" ? "Live online" : m.label }))} /></Field>
        <Field label="When are you usually available?" required><Pills name="availability" required options={AVAILABILITY.map((a) => ({ value: a, label: a }))} /></Field>
        <Field label="How did you hear about us?" htmlFor={`${id}-heard`}>
          <select id={`${id}-heard`} name="heardFrom" defaultValue="" className={`${input} cursor-pointer`}>
            <option value="">Select an option</option>
            {HEARD_FROM.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </Field>
      </Section>

      <div className="border-t border-line pt-7">
        <label className="flex cursor-pointer items-start gap-3 text-[15px] text-body"><input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-accent" /> <span>I agree to the <Link href="/privacy" target="_blank" className="font-semibold text-accent underline">privacy policy</Link> and to being contacted about my application.</span></label>
      </div>

      <div aria-live="polite" className="empty:hidden">{!pending && state?.error && <p className="rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}</div>
      <button type="submit" disabled={pending} className="flex h-13 w-full cursor-pointer items-center justify-center rounded-[5px] bg-accent text-[16px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(79,63,215,.9)] transition hover:bg-accent-dark disabled:cursor-wait disabled:opacity-70">
        {pending ? "Sending your application…" : "Submit application"}
      </button>
    </form>
  );
}
