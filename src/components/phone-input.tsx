"use client";

import { useState } from "react";
import { COUNTRIES, countryByCode, flag } from "@/lib/countries";

/**
 * Phone number with a flag picker. Submits "dialCode" (e.g. +234) and "phone" (the national number);
 * combine them on the server with formatPhone(). Pass `country` and `onCountryChange` to control the
 * picker from outside (the enrolment form keeps it in step with the student's country).
 */
export function PhoneInput({ id, defaultCountry = "GB", defaultValue, placeholder, country: controlled, onCountryChange }: {
  id: string;
  defaultCountry?: string;
  defaultValue?: string;
  placeholder?: string;
  country?: string;
  onCountryChange?: (code: string) => void;
}) {
  const [own, setOwn] = useState(countryByCode(defaultCountry)?.code ?? "GB");
  const country = countryByCode(controlled ?? own) ?? countryByCode("GB")!;
  function choose(code: string) {
    setOwn(code);
    onCountryChange?.(code);
  }
  return (
    <div className="flex h-12 rounded-[5px] border border-edge-strong bg-surface transition hover:border-accent-muted focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
      <div className="relative flex shrink-0 items-center gap-1 pl-3 pr-2">
        <span aria-hidden="true" className="text-lg leading-none">{flag(country.code)}</span>
        <span className="text-sm text-muted">{country.dial}</span>
        <svg viewBox="0 0 10 6" className="size-2 text-ink" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor" /></svg>
        <select aria-label="Country code" value={country.code} onChange={(e) => choose(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{flag(c.code)} {c.name} ({c.dial})</option>)}
        </select>
      </div>
      <input type="hidden" name="dialCode" value={country.dial} />
      <input id={id} name="phone" type="tel" required maxLength={30} autoComplete="tel-national" defaultValue={defaultValue} placeholder={placeholder ?? country.example ?? "Phone number"} className="h-full min-w-0 grow bg-transparent pr-3.5 text-[15px] text-ink placeholder:text-[#878598] focus:outline-none" />
    </div>
  );
}
