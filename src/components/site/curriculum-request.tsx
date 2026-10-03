"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { requestCurriculum, type CurriculumRequestState } from "@/app/actions/leads";
import { ArrowRight, CheckIcon, ClockIcon, DownloadIcon, LayersIcon, LockIcon, PlayIcon, XIcon } from "@/components/icons";
import { PhoneInput } from "@/components/phone-input";
import type { PublicModule } from "@/lib/curriculum";
import { LEAD_BACKGROUNDS } from "@/lib/leads";

const inputClass = "h-12 w-full rounded-[5px] border border-edge-strong bg-white px-3.5 text-[15px] text-ink transition placeholder:text-[#878598] hover:border-accent-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

function Label({ htmlFor, children, optional }: { htmlFor?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
      {children}{optional ? <span className="font-normal text-muted"> (optional)</span> : <span className="text-red-600" aria-hidden="true"> *</span>}
    </label>
  );
}

/** UTM tags from the page address, else the site that linked here: where this lead came from. */
function leadSource(): string {
  const params = new URLSearchParams(window.location.search);
  const utm = ["utm_source", "utm_medium", "utm_campaign"].map((k) => params.get(k)?.trim()).filter(Boolean);
  if (utm.length) return utm.join(" / ");
  try {
    const referrer = document.referrer ? new URL(document.referrer).hostname : "";
    return referrer && referrer !== window.location.hostname ? referrer : "direct";
  } catch {
    return "direct";
  }
}

const storageKey = (courseId: number) => `curriculum:${courseId}`;

type Props = {
  courseId: number;
  courseTitle: string;
  modules: PublicModule[];
  weeks: number | null;
  level: string;
  defaultCountry?: string;
  prefill?: { name: string; email: string };
  enrol: { href: string; label: string };
  className?: string;
};

/**
 * "View curriculum": asks for contact details (a marketing lead), then shows the curriculum and emails a copy.
 * Someone who has already filled it in on this device goes straight to the curriculum.
 */
export function CurriculumRequest({ courseId, courseTitle, modules, weeks, level, defaultCountry = "GB", prefill, enrol, className }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState<CurriculumRequestState, FormData>(requestCurriculum.bind(null, courseId), undefined);
  const [sentTo, setSentTo] = useState("");
  const [remembered, setRemembered] = useState<{ url: string | null; email: string } | null>(null);
  const id = useId();
  const lessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const unlocked = state?.done ? { url: state.url ?? null, email: sentTo } : remembered;

  function open() {
    try {
      const saved = localStorage.getItem(storageKey(courseId));
      if (saved) setRemembered(JSON.parse(saved));
    } catch {}
    dialog.current?.showModal();
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("source", leadSource());
    const email = String(formData.get("email") ?? "");
    setSentTo(email);
    startTransition(() => formAction(formData));
  }

  // Once accepted, remember it on this device so they aren't asked again.
  useEffect(() => {
    if (!state?.done) return;
    try { localStorage.setItem(storageKey(courseId), JSON.stringify({ url: state.url ?? null, email: sentTo })); } catch {}
  }, [state, courseId, sentTo]);

  return (
    <>
      <button type="button" onClick={open} className={className}>View curriculum</button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}
        className="m-auto w-[min(940px,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-[5px] bg-white p-0 text-left shadow-[0_40px_120px_-30px_rgba(12,11,18,.6)] backdrop:bg-[#0c0b12]/65 backdrop:backdrop-blur-[3px]"
      >
        <div className="grid max-h-[92dvh] overflow-y-auto md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
          {/* What's inside */}
          <aside className="relative overflow-hidden bg-[linear-gradient(135deg,#5b4be0_0%,#4f3fd7_45%,#3d2fb8_100%)] px-6 py-7 text-white sm:px-8 md:py-10">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full border border-white/10" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full bg-white/[.06]" />
            <div className="relative flex h-full flex-col gap-5">
              <span className="w-fit rounded-full bg-white/[.12] px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-white/90">Free curriculum</span>
              <p className="font-display text-[22px] font-bold leading-tight tracking-[-0.4px] md:text-[26px]">{courseTitle}</p>
              <ul className="flex flex-wrap gap-2 text-[13px]">
                {modules.length > 0 && <li className="flex items-center gap-1.5 rounded-[5px] bg-white/[.1] px-2.5 py-1.5"><LayersIcon className="size-4 text-[#b9f0ff]" />{modules.length} module{modules.length === 1 ? "" : "s"}</li>}
                {lessons > 0 && <li className="flex items-center gap-1.5 rounded-[5px] bg-white/[.1] px-2.5 py-1.5"><PlayIcon className="size-4 text-[#b9f0ff]" />{lessons} lesson{lessons === 1 ? "" : "s"}</li>}
                {weeks ? <li className="flex items-center gap-1.5 rounded-[5px] bg-white/[.1] px-2.5 py-1.5"><ClockIcon className="size-4 text-[#b9f0ff]" />{weeks} weeks</li> : null}
                {level && <li className="rounded-[5px] bg-white/[.1] px-2.5 py-1.5">{level}</li>}
              </ul>
              {modules.length > 0 && (
                <div className="hidden flex-col gap-3 md:flex">
                  <p className="text-sm font-semibold text-white/75">What you&apos;ll cover</p>
                  <ol className="flex flex-col gap-2.5">
                    {modules.slice(0, 5).map((m, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px] leading-snug">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[.14] font-mono text-[11px] font-semibold">{String(i + 1).padStart(2, "0")}</span>
                        <span className={unlocked ? "" : i > 1 ? "select-none blur-[3px]" : ""}>{m.title}</span>
                      </li>
                    ))}
                  </ol>
                  {modules.length > 5 && <p className="pl-9 text-[13px] text-white/65">+ {modules.length - 5} more module{modules.length - 5 === 1 ? "" : "s"}</p>}
                </div>
              )}
              <p className="mt-auto hidden items-center gap-2 pt-4 text-[13px] text-white/70 md:flex"><LockIcon className="size-4" /> Your details stay private.</p>
            </div>
          </aside>

          <div className="relative px-6 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-10 md:overflow-y-auto">
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="absolute right-3 top-3 flex size-10 cursor-pointer items-center justify-center rounded-[5px] text-muted transition hover:bg-page hover:text-ink sm:right-5 sm:top-5">
              <XIcon className="size-5" />
            </button>

            {unlocked ? (
              <div className="flex flex-col gap-5">
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckIcon className="size-6" /></span>
                <div className="flex flex-col gap-2 pr-8">
                  <h2 id={`${id}-title`} className="font-display text-[26px] font-bold leading-tight tracking-[-0.5px] text-ink">Here&apos;s your curriculum</h2>
                  <p className="text-[15px] leading-relaxed text-muted">{unlocked.email ? <>We&apos;ve also emailed a copy to <strong className="font-semibold text-ink">{unlocked.email}</strong>.</> : "We've also emailed you a copy."}</p>
                </div>
                {unlocked.url && (
                  <a href={unlocked.url} target="_blank" rel="noopener noreferrer" download className="inline-flex h-12 w-fit items-center gap-2 rounded-[5px] bg-accent px-6 text-[15px] font-semibold text-white transition hover:bg-accent-dark">
                    <DownloadIcon className="size-5" /> Download the full curriculum
                  </a>
                )}
                {modules.length > 0 && (
                  <ol className="flex max-h-[42dvh] flex-col divide-y divide-line overflow-y-auto rounded-[5px] border border-edge">
                    {modules.map((m, i) => (
                      <li key={i}>
                        <details className="group" open={i === 0}>
                          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-page">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                            <span className="grow text-[15px] font-semibold text-ink">{m.title}</span>
                            {m.lessons.length > 0 && <span className="shrink-0 text-[13px] text-muted">{m.lessons.length} lesson{m.lessons.length === 1 ? "" : "s"}</span>}
                          </summary>
                          {(m.summary || m.lessons.length > 0) && (
                            <div className="flex flex-col gap-2 px-4 pb-4 pl-14">
                              {m.summary && <p className="text-sm text-muted">{m.summary}</p>}
                              {m.lessons.length > 0 && (
                                <ul className="flex flex-col gap-1.5">
                                  {m.lessons.map((l, j) => (
                                    <li key={j} className="flex items-center justify-between gap-3 text-sm text-body">
                                      <span className="flex items-center gap-2"><CheckIcon className="size-3.5 shrink-0 text-accent" />{l.title}</span>
                                      {l.minutes > 0 && <span className="shrink-0 text-xs text-muted">{l.minutes} min</span>}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </details>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
                  <Link href={enrol.href} onClick={() => dialog.current?.close()} className="group inline-flex h-12 items-center gap-2 rounded-[5px] bg-ink px-6 text-[15px] font-semibold text-white transition hover:bg-black">
                    {enrol.label} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <p className="text-sm text-muted">Questions? Just reply to our email.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2 pr-10">
                  <h2 id={`${id}-title`} className="font-display text-[26px] font-bold leading-tight tracking-[-0.5px] text-ink sm:text-[30px]">Get the full curriculum</h2>
                  <p className="text-[15px] leading-relaxed text-muted">Tell us a little about you to see it straight away. We&apos;ll email you a copy too.</p>
                </div>
                <form onSubmit={onSubmit} aria-busy={pending} className="mt-7 flex flex-col gap-5">
                  {/* Left empty by people; bots fill it in. */}
                  <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label></div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${id}-name`}>Full name</Label>
                      <input id={`${id}-name`} name="name" required maxLength={120} autoComplete="name" defaultValue={prefill?.name} placeholder="e.g. Ada Okafor" className={inputClass} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${id}-email`}>Email address</Label>
                      <input id={`${id}-email`} name="email" type="email" required maxLength={200} autoComplete="email" defaultValue={prefill?.email} placeholder="you@example.com" className={inputClass} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${id}-phone`}>Phone number (WhatsApp preferred)</Label>
                    <PhoneInput id={`${id}-phone`} defaultCountry={defaultCountry} />
                  </div>
                  <fieldset className="flex min-w-0 flex-col gap-2.5">
                    <legend className="mb-2.5"><Label optional>Which best describes you?</Label></legend>
                    <div className="flex flex-wrap gap-2">
                      {LEAD_BACKGROUNDS.map((b) => (
                        <label key={b} className="flex h-9 cursor-pointer items-center rounded-full border border-edge-strong px-3.5 text-[13px] font-semibold text-body transition hover:border-accent-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/15">
                          <input type="radio" name="background" value={b} className="sr-only" />{b}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm text-body">
                    <input type="checkbox" name="marketing" className="mt-0.5 size-4 shrink-0 accent-accent" />
                    <span>Send me news about new cohorts, scholarships and offers. You can unsubscribe at any time.</span>
                  </label>
                  <div aria-live="polite" className="empty:hidden">
                    {!pending && state?.error && <p className="rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
                  </div>
                  <button type="submit" disabled={pending} className="group inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[5px] bg-accent px-6 text-[15px] font-semibold text-white transition hover:bg-accent-dark disabled:cursor-wait disabled:opacity-70">
                    {pending ? "Unlocking…" : <>Get the curriculum <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></>}
                  </button>
                  <p className="text-center text-[13px] text-muted">By continuing you agree to our <Link href="/privacy" target="_blank" className="font-semibold text-accent hover:text-accent-dark">privacy policy</Link>.</p>
                </form>
              </>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
