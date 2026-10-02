"use client";

import { useActionState, useId, useState } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist";

const input = "h-11 w-full rounded-[5px] border border-edge-strong bg-white px-3 text-[15px] text-ink placeholder:text-[#878598] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

/** Shown on a full cohort: join its waitlist and be emailed if a place opens. */
export function WaitlistForm({ cohortId }: { cohortId: number }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist.bind(null, cohortId), undefined);
  if (state?.ok) return <p className="rounded-[5px] bg-emerald-50 px-4 py-3 text-[15px] font-medium text-emerald-800">{state.ok}</p>;
  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-muted">This cohort is full.</p>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 cursor-pointer items-center rounded-[5px] border border-accent px-5 text-[15px] font-semibold text-accent hover:bg-accent-soft">Join the waitlist</button>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm text-muted">We&apos;ll email you if a place opens. Places go to people in the order they joined.</p>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${id}-name`} className="sr-only">Your name</label>
        <input id={`${id}-name`} name="name" required maxLength={120} autoComplete="name" placeholder="Your name" className={input} />
        <label htmlFor={`${id}-email`} className="sr-only">Email address</label>
        <input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" placeholder="Email address" className={input} />
      </div>
      <label htmlFor={`${id}-phone`} className="sr-only">Phone (optional)</label>
      <input id={`${id}-phone`} name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="Phone or WhatsApp (optional)" className={input} />
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="inline-flex h-11 cursor-pointer items-center rounded-[5px] bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-dark disabled:opacity-60">{pending ? "Joining…" : "Join the waitlist"}</button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 items-center rounded-[5px] px-3 text-sm font-semibold text-muted hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}
