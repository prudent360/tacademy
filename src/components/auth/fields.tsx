"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, UserIcon } from "@/components/icons";
import { COUNTRIES, countryByCode, flag } from "@/lib/countries";

const field = "h-12 w-full rounded-[8px] border border-edge bg-panel pl-11 pr-3.5 text-[15px] text-ink transition placeholder:text-[#878598] hover:border-accent-muted focus:border-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent/10";

/** Email input with a leading icon, for the sign-in and account pages. */
export function EmailField({ label = "Email address", name = "email", autoComplete = "username" }: { label?: string; name?: string; autoComplete?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <div className="relative">
        <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input id={id} name={name} type="email" autoComplete={autoComplete} required placeholder="you@example.com" className={field} />
      </div>
    </div>
  );
}

/** Name input with a leading icon, for creating an account. */
export function NameField({ label = "Full name", name = "name", autoComplete = "name", placeholder = "Your full name" }: { label?: string; name?: string; autoComplete?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <div className="relative">
        <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input id={id} name={name} autoComplete={autoComplete} required minLength={1} maxLength={60} placeholder={placeholder} className={field} />
      </div>
    </div>
  );
}

/** Password input with a leading icon and a show/hide toggle. */
export function PasswordField({ label = "Password", name = "password", autoComplete = "current-password", minLength, hint }: { label?: string; name?: string; autoComplete?: string; minLength?: number; hint?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <div className="relative">
        <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} placeholder="••••••••" aria-describedby={hint ? `${id}-hint` : undefined} className={`${field} pr-12`} />
        <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-page hover:text-ink">
          {visible ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
        </button>
      </div>
      {hint && <p id={`${id}-hint`} className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

const select = "h-12 w-full cursor-pointer appearance-none rounded-[8px] border border-edge bg-panel pl-3.5 pr-9 text-[15px] text-ink transition hover:border-accent-muted focus:border-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent/10";

function Chevron() {
  return <svg viewBox="0 0 10 6" className="pointer-events-none absolute right-3.5 top-1/2 size-2.5 -translate-y-1/2 text-ink" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor" /></svg>;
}

/** Gender, country and phone for the sign-up form. The phone's country code follows the chosen country. */
export function ProfileFields({ defaultCountry }: { defaultCountry?: string }) {
  const id = useId();
  const [country, setCountry] = useState(countryByCode(defaultCountry)?.code ?? "");
  const [phoneCountry, setPhoneCountry] = useState(country || "NG");
  const dial = countryByCode(phoneCountry) ?? countryByCode("NG")!;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-gender`} className="text-sm font-medium text-ink">Gender</label>
          <div className="relative">
            <select id={`${id}-gender`} name="gender" required defaultValue="" className={select}>
              <option value="" disabled>Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
            <Chevron />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-country`} className="text-sm font-medium text-ink">Country</label>
          <div className="relative">
            <select id={`${id}-country`} name="country" required value={country} onChange={(e) => { setCountry(e.target.value); if (countryByCode(e.target.value)) setPhoneCountry(e.target.value); }} className={select}>
              <option value="" disabled>Select your country</option>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{flag(c.code)} {c.name}</option>)}
            </select>
            <Chevron />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-phone`} className="text-sm font-medium text-ink">Phone number</label>
        <div className="flex h-12 rounded-[8px] border border-edge bg-panel transition hover:border-accent-muted focus-within:border-accent focus-within:bg-white focus-within:ring-4 focus-within:ring-accent/10">
          <div className="relative flex shrink-0 items-center gap-1.5 border-r border-edge pl-3.5 pr-3">
            <span aria-hidden="true" className="text-lg leading-none">{flag(dial.code)}</span>
            <span className="text-[15px] text-body">{dial.dial}</span>
            <svg viewBox="0 0 10 6" className="size-2 text-ink" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor" /></svg>
            <select aria-label="Country code" value={dial.code} onChange={(e) => setPhoneCountry(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{flag(c.code)} {c.name} ({c.dial})</option>)}
            </select>
          </div>
          <input type="hidden" name="dialCode" value={dial.dial} />
          <input id={`${id}-phone`} name="phone" type="tel" required maxLength={30} autoComplete="tel-national" placeholder={dial.example ?? "Phone number"} className="h-full min-w-0 grow bg-transparent px-3.5 text-[15px] text-ink placeholder:text-[#878598] focus:outline-none" />
        </div>
      </div>
    </>
  );
}
