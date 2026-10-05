"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { applyForJob, type JobApplyState } from "@/app/actions/careers";
import { ArrowRight } from "@/components/icons";
import { PhoneInput } from "@/components/phone-input";
import { HEARD_FROM } from "@/lib/applications";
import { NOTICE_PERIODS } from "@/lib/careers";
import { COUNTRIES, countryByCode, flag } from "@/lib/countries";

const input = "h-12 w-full rounded-[5px] border border-edge-strong bg-white px-3.5 text-[15px] text-ink transition placeholder:text-[#878598] hover:border-accent-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";
const NOTE_MAX = 5000;

function Field({ label, htmlFor, required, hint, children }: { label: string; htmlFor?: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}{required ? <span className="text-red-600" aria-hidden="true"> *</span> : <span className="font-normal text-muted"> (optional)</span>}</label>
      {children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

/** The application form at the bottom of a role's page. Checked again on the server. */
export function JobApplyForm({ jobId, jobTitle, defaultCountry }: { jobId: number; jobTitle: string; defaultCountry?: string }) {
  const id = useId();
  const [state, action, pending] = useActionState<JobApplyState, FormData>(applyForJob.bind(null, jobId), undefined);
  const [country, setCountry] = useState(countryByCode(defaultCountry)?.code ?? "");
  const [phoneCountry, setPhoneCountry] = useState(country || "NG");
  const [note, setNote] = useState("");

  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-5">
      {/* Left empty by people; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor={`${id}-name`} required><input id={`${id}-name`} name="name" required maxLength={120} autoComplete="name" className={input} /></Field>
        <Field label="Email address" htmlFor={`${id}-email`} required><input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" className={input} /></Field>
      </div>
      <Field label="Phone number" htmlFor={`${id}-phone`} required><PhoneInput id={`${id}-phone`} country={phoneCountry} onCountryChange={setPhoneCountry} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Country" htmlFor={`${id}-country`} required>
          <select id={`${id}-country`} name="country" required value={country} onChange={(e) => { setCountry(e.target.value); if (countryByCode(e.target.value)) setPhoneCountry(e.target.value); }} className={`${input} cursor-pointer`}>
            <option value="">Select your country</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{flag(c.code)} {c.name}</option>)}
          </select>
        </Field>
        <Field label="City" htmlFor={`${id}-city`}><input id={`${id}-city`} name="city" maxLength={80} autoComplete="address-level2" className={input} /></Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="LinkedIn profile" htmlFor={`${id}-linkedin`}><input id={`${id}-linkedin`} name="linkedinUrl" type="url" maxLength={500} placeholder="https://www.linkedin.com/in/…" className={input} /></Field>
        <Field label="Portfolio or website" htmlFor={`${id}-portfolio`}><input id={`${id}-portfolio`} name="portfolioUrl" type="url" maxLength={500} placeholder="https://" className={input} /></Field>
      </div>
      <Field label="CV" htmlFor={`${id}-cv`} required hint="PDF or Word, up to 4 MB.">
        <input id={`${id}-cv`} name="cv" type="file" required accept=".pdf,.doc,.docx,application/pdf" className="w-full min-w-0 max-w-full rounded-[5px] border border-dashed border-edge-strong bg-panel p-3 text-sm text-body file:mr-3 file:h-10 file:cursor-pointer file:rounded-[5px] file:border-0 file:bg-accent-soft file:px-4 file:font-semibold file:text-accent" />
      </Field>
      <Field label={`Why are you a great fit for ${jobTitle}?`} htmlFor={`${id}-note`} required hint="A few sentences about your experience and what draws you to the role.">
        <textarea id={`${id}-note`} name="coverLetter" required minLength={40} maxLength={NOTE_MAX} rows={6} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-[5px] border border-edge-strong bg-white px-3.5 py-3 text-[15px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
        <p className={`-mt-1 text-right text-xs ${note.length > NOTE_MAX - 200 ? "text-amber-800" : "text-muted"}`}>{note.length.toLocaleString()}/{NOTE_MAX.toLocaleString()}</p>
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="When could you start?" htmlFor={`${id}-notice`}>
          <select id={`${id}-notice`} name="noticePeriod" defaultValue="" className={`${input} cursor-pointer`}>
            <option value="">Select</option>
            {NOTICE_PERIODS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Pay expectation" htmlFor={`${id}-salary`}><input id={`${id}-salary`} name="salaryExpectation" maxLength={120} placeholder="e.g. ₦500,000 a month" className={input} /></Field>
        <Field label="How did you hear about us?" htmlFor={`${id}-heard`}>
          <select id={`${id}-heard`} name="heardFrom" defaultValue="" className={`${input} cursor-pointer`}>
            <option value="">Select</option>
            {HEARD_FROM.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </Field>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-body">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-accent" />
        <span>I agree that my details and CV are kept to assess my application, as described in the <Link href="/privacy" target="_blank" className="font-semibold text-accent hover:text-accent-dark">privacy policy</Link>.</span>
      </label>
      <div aria-live="polite" className="empty:hidden">
        {!pending && state?.error && <p className="rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
      </div>
      <button type="submit" disabled={pending} className="group inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[5px] bg-accent px-6 text-[15px] font-semibold text-white transition hover:bg-accent-dark disabled:cursor-wait disabled:opacity-70 sm:w-fit">
        {pending ? "Sending your application…" : <>Submit application <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></>}
      </button>
    </form>
  );
}
