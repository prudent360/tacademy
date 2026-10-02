"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function Star({ filled, className = "size-5" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z" fill={filled ? "#f59e0b" : "none"} stroke={filled ? "#f59e0b" : "#c9c6d6"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Star rating and a short review of a finished course. */
export function ReviewForm({ action, initial }: { action: Action; initial?: { rating: number; body: string } }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;
  if (state?.ok) return <p className="rounded-[5px] bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{state.ok}</p>;
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <fieldset className="flex items-center gap-3">
        <legend className="sr-only">Your rating</legend>
        <span className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" aria-label={`${n} star${n === 1 ? "" : "s"}: ${LABELS[n]}`} />
              <span className="block rounded-sm peer-focus-visible:ring-2 peer-focus-visible:ring-accent"><Star filled={n <= shown} className="size-7" /></span>
            </label>
          ))}
        </span>
        <span className="text-sm font-semibold text-muted">{LABELS[shown] || "Tap to rate"}</span>
      </fieldset>
      <textarea name="body" required minLength={10} maxLength={1000} rows={3} defaultValue={initial?.body} placeholder="What did you enjoy? What could be better? Would you recommend it?" className="w-full rounded-[5px] border border-edge-strong bg-white px-3.5 py-3 text-[15px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <div><button type="submit" disabled={pending || !rating} className="inline-flex h-10 cursor-pointer items-center rounded-[5px] bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Sending…" : initial ? "Update review" : "Submit review"}</button></div>
    </form>
  );
}
