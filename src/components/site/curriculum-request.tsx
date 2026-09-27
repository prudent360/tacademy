"use client";

import { startTransition, useActionState, useId, useRef, useState } from "react";
import { requestCurriculum, type CurriculumRequestState } from "@/app/actions/leads";
import { CheckCircleIcon, DownloadIcon, XIcon } from "@/components/icons";

const COUNTRIES = [
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

const inputClass = "h-12 w-full rounded-[5px] border border-edge-strong bg-white px-3.5 text-[15px] text-ink transition placeholder:text-[#8b8598] hover:border-accent-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{children} <span className="text-red-600" aria-hidden="true">*</span></label>;
}

/** "View curriculum" button that asks for contact details, then hands over the course's curriculum document. */
export function CurriculumRequest({ courseId, courseTitle, defaultCountry = "GB", className }: { courseId: number; courseTitle: string; defaultCountry?: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState<CurriculumRequestState, FormData>(requestCurriculum.bind(null, courseId), undefined);
  const [country, setCountry] = useState(COUNTRIES.find((c) => c.code === defaultCountry) ?? COUNTRIES[1]);
  const [sentTo, setSentTo] = useState("");
  const id = useId();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSentTo(String(formData.get("email") ?? ""));
    startTransition(() => formAction(formData));
  }

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={className}>View curriculum</button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
        className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-[24px] bg-white p-0 text-left shadow-2xl backdrop:bg-navy/60 backdrop:backdrop-blur-sm"
      >
        <div className="relative max-h-[90dvh] overflow-y-auto px-6 pb-9 pt-10 sm:px-12 sm:pb-12 sm:pt-14">
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="absolute right-4 top-4 flex size-10 cursor-pointer items-center justify-center rounded-lg text-accent hover:bg-accent-soft sm:right-6 sm:top-6">
            <XIcon className="size-6" />
          </button>

          {state?.url ? (
            <div className="flex flex-col items-start gap-4">
              <CheckCircleIcon className="size-12 text-emerald-600" />
              <h2 id={`${id}-title`} className="font-display text-3xl font-bold tracking-tight text-ink">Your curriculum is ready</h2>
              <p className="text-[15px] leading-relaxed text-muted">Download the full <strong className="text-ink">{courseTitle}</strong> curriculum below. We&apos;ve also emailed a copy to <strong className="text-ink">{sentTo}</strong>.</p>
              <a href={state.url} target="_blank" rel="noopener noreferrer" download className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-dark">
                <DownloadIcon className="size-5" /> Download curriculum
              </a>
            </div>
          ) : (
            <>
              <h2 id={`${id}-title`} className="pr-10 font-display text-3xl font-bold tracking-tight text-ink sm:text-[34px]">Request Curriculum</h2>
              <form onSubmit={onSubmit} aria-busy={pending} className="mt-8 flex flex-col gap-6">
                <div className="flex flex-col gap-2.5">
                  <Label htmlFor={`${id}-name`}>Your Name</Label>
                  <input id={`${id}-name`} name="name" required maxLength={120} autoComplete="name" className={inputClass} />
                </div>
                <div className="flex flex-col gap-2.5">
                  <Label htmlFor={`${id}-email`}>Your Email</Label>
                  <input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} />
                </div>
                <div className="flex flex-col gap-2.5">
                  <Label htmlFor={`${id}-phone`}>Phone</Label>
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
                    <input id={`${id}-phone`} name="phone" type="tel" required maxLength={30} autoComplete="tel-national" placeholder={country.example} className="h-full min-w-0 grow bg-transparent pr-3.5 text-[17px] text-ink placeholder:text-[#8b8598] focus:outline-none" />
                  </div>
                </div>
                <div aria-live="polite" className="empty:hidden">
                  {!pending && state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
                </div>
                <button type="submit" disabled={pending} className="inline-flex h-12 w-fit cursor-pointer items-center rounded-full bg-accent px-6 text-[16px] font-semibold text-white hover:bg-accent-dark disabled:cursor-wait disabled:opacity-70">
                  {pending ? "Sending…" : "Get Full Curriculum"}
                </button>
              </form>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
