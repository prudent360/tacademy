"use client";

import { useState } from "react";

export const COUNTRIES = [
  { code: "NG", flag: "🇳🇬", name: "Nigeria", dial: "+234", example: "0803 123 4567" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom", dial: "+44", example: "07400 123456" },
  { code: "US", flag: "🇺🇸", name: "United States", dial: "+1", example: "(201) 555-0123" },
  { code: "CA", flag: "🇨🇦", name: "Canada", dial: "+1", example: "(506) 234-5678" },
  { code: "IE", flag: "🇮🇪", name: "Ireland", dial: "+353", example: "085 012 3456" },
  { code: "GH", flag: "🇬🇭", name: "Ghana", dial: "+233", example: "023 123 4567" },
  { code: "KE", flag: "🇰🇪", name: "Kenya", dial: "+254", example: "0712 123456" },
  { code: "ZA", flag: "🇿🇦", name: "South Africa", dial: "+27", example: "071 123 4567" },
  { code: "AE", flag: "🇦🇪", name: "United Arab Emirates", dial: "+971", example: "050 123 4567" },
  { code: "DE", flag: "🇩🇪", name: "Germany", dial: "+49", example: "01512 3456789" },
  { code: "IN", flag: "🇮🇳", name: "India", dial: "+91", example: "081234 56789" },
  { code: "AU", flag: "🇦🇺", name: "Australia", dial: "+61", example: "0412 345 678" },
] as const;

/**
 * Phone number with a flag picker. Submits "dialCode" (e.g. +234) and "phone" (the national number);
 * combine them on the server with formatPhone().
 */
export function PhoneInput({ id, defaultCountry = "GB", defaultValue, placeholder }: { id: string; defaultCountry?: string; defaultValue?: string; placeholder?: string }) {
  const [country, setCountry] = useState(COUNTRIES.find((c) => c.code === defaultCountry) ?? COUNTRIES[1]);
  return (
    <div className="flex h-12 rounded-[5px] border border-edge-strong bg-white transition hover:border-accent-muted focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
      <div className="relative flex shrink-0 items-center gap-1 pl-3 pr-2">
        <span aria-hidden="true" className="text-lg leading-none">{country.flag}</span>
        <svg viewBox="0 0 10 6" className="size-2 text-ink" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor" /></svg>
        <select
          aria-label="Country code"
          value={country.code}
          onChange={(e) => setCountry(COUNTRIES.find((c) => c.code === e.target.value) ?? country)}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</option>)}
        </select>
      </div>
      <input type="hidden" name="dialCode" value={country.dial} />
      <input id={id} name="phone" type="tel" required maxLength={30} autoComplete="tel-national" defaultValue={defaultValue} placeholder={placeholder ?? country.example} className="h-full min-w-0 grow bg-transparent pr-3.5 text-[15px] text-ink placeholder:text-[#8b8598] focus:outline-none" />
    </div>
  );
}
