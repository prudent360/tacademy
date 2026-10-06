"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { signUpForFreeClass, type FreeClassSignupState } from "@/app/actions/free-classes";
import { ArrowRight } from "@/components/icons";
import { PhoneInput } from "@/components/phone-input";
import { HEARD_FROM } from "@/lib/applications";
import { LEAD_BACKGROUNDS } from "@/lib/leads";

const input = "h-12 w-full rounded-[5px] border border-edge-strong bg-white px-3.5 text-[15px] text-ink transition placeholder:text-[#878598] hover:border-accent-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

function Field({ label, htmlFor, required, children }: { label: string; htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}{required ? <span className="text-red-600" aria-hidden="true"> *</span> : <span className="font-normal text-muted"> (optional)</span>}</label>
      {children}
    </div>
  );
}

/** Sign-up for a free class: no account, just enough to send the joining details and reminders. Checked again on the server. */
export function FreeClassSignupForm({ classId, defaultCountry }: { classId: number; defaultCountry?: string }) {
  const id = useId();
  const [state, action, pending] = useActionState<FreeClassSignupState, FormData>(signUpForFreeClass.bind(null, classId), undefined);
  const [phoneCountry, setPhoneCountry] = useState(defaultCountry || "NG");

  return (
    <form action={action} aria-busy={pending} className="flex flex-col gap-5">
      {/* Left empty by people; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <Field label="Full name" htmlFor={`${id}-name`} required><input id={`${id}-name`} name="name" required maxLength={120} autoComplete="name" className={input} /></Field>
      <Field label="Email address" htmlFor={`${id}-email`} required><input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" className={input} /></Field>
      <Field label="Phone number" htmlFor={`${id}-phone`} required><PhoneInput id={`${id}-phone`} country={phoneCountry} onCountryChange={setPhoneCountry} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Which best describes you?" htmlFor={`${id}-bg`}>
          <select id={`${id}-bg`} name="background" defaultValue="" className={`${input} cursor-pointer`}>
            <option value="">Select</option>
            {LEAD_BACKGROUNDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="How did you hear about us?" htmlFor={`${id}-heard`}>
          <select id={`${id}-heard`} name="heardFrom" defaultValue="" className={`${input} cursor-pointer`}>
            <option value="">Select</option>
            {HEARD_FROM.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </Field>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-body">
        <input type="checkbox" name="whatsapp" className="mt-0.5 size-4 shrink-0 accent-accent" />
        <span>Also remind me on WhatsApp</span>
      </label>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-body">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-accent" />
        <span>I agree that my details are used to send me the class details, reminders and one follow-up offer, as described in the <Link href="/privacy" target="_blank" className="font-semibold text-accent hover:text-accent-dark">privacy policy</Link>.</span>
      </label>
      <div aria-live="polite" className="empty:hidden">
        {!pending && state?.error && <p className="rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
      </div>
      <button type="submit" disabled={pending} className="group inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-6 text-[15px] font-semibold text-white transition hover:bg-accent-dark disabled:cursor-wait disabled:opacity-70">
        {pending ? "Saving your place…" : <>Save my free place <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></>}
      </button>
    </form>
  );
}
