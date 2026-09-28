"use client";

import { startTransition, useActionState, useId, useRef, useState } from "react";
import { requestCurriculum, type CurriculumRequestState } from "@/app/actions/leads";
import { CheckCircleIcon, DownloadIcon, XIcon } from "@/components/icons";
import { PhoneInput } from "@/components/phone-input";


const inputClass = "h-12 w-full rounded-[5px] border border-edge-strong bg-white px-3.5 text-[15px] text-ink transition placeholder:text-[#8b8598] hover:border-accent-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{children} <span className="text-red-600" aria-hidden="true">*</span></label>;
}

/** "View curriculum" button that asks for contact details, then hands over the course's curriculum document. */
export function CurriculumRequest({ courseId, courseTitle, defaultCountry = "GB", className }: { courseId: number; courseTitle: string; defaultCountry?: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState<CurriculumRequestState, FormData>(requestCurriculum.bind(null, courseId), undefined);
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
                  <PhoneInput id={`${id}-phone`} defaultCountry={defaultCountry} />
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
