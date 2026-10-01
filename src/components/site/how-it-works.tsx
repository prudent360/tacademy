"use client";

import { useState } from "react";
import { BellIcon, CalendarIcon, CardIcon, CheckIcon, MessageIcon, PhoneIcon, VideoIcon } from "@/components/icons";

export type Step = { title: string; text: string };

const bar = (width: string, tone = "bg-line") => <span className={`block h-1.5 rounded-full ${tone} ${width}`} />;

function Window({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-[270px] overflow-hidden rounded-[12px] bg-white shadow-[0_28px_60px_-24px_rgba(8,5,30,.65)]">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2.5">
        <span className="size-2 rounded-full bg-red-400" /><span className="size-2 rounded-full bg-amber-400" /><span className="size-2 rounded-full bg-emerald-400" />
        <span className="ml-auto text-[10px] font-semibold text-muted">{label}</span>
      </div>
      <div className="flex flex-col gap-2 bg-panel p-3">{children}</div>
    </div>
  );
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return <div className={`absolute flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-bold text-ink shadow-[0_14px_30px_-12px_rgba(8,5,30,.55)] ${className}`}>{children}</div>;
}

/** One small picture per step, drawn at 420×320. */
const SCENES: React.ReactNode[] = [
  // Choose a cohort
  <>
    <Window label="Courses">
      {[{ tone: "bg-accent", picked: true }, { tone: "bg-cyan", picked: false }, { tone: "bg-amber-400", picked: false }].map((c, i) => (
        <div key={i} className={`flex items-center gap-2.5 rounded-md bg-white p-2.5 ${c.picked ? "ring-2 ring-accent" : "shadow-[0_1px_2px_rgba(24,19,64,.06)]"}`}>
          <span className={`size-8 shrink-0 rounded-md ${c.tone}`} />
          <span className="flex grow flex-col gap-1.5">{bar(i === 1 ? "w-20" : "w-24", "bg-edge-strong")}{bar("w-14")}</span>
          {c.picked && <span className="flex size-5 items-center justify-center rounded-full bg-accent text-white"><CheckIcon className="size-3" /></span>}
        </div>
      ))}
    </Window>
    <Chip className="-left-6 top-6"><CalendarIcon className="size-4 text-accent" /> Starts Mon 6 Oct</Chip>
    <Chip className="-right-4 bottom-8"><span className="size-2 rounded-full bg-emerald-500" /> Live online · Evenings</Chip>
  </>,
  // Pay securely
  <>
    <Window label="Checkout">
      <div className="flex items-center justify-between rounded-md bg-white p-2.5"><span className="flex flex-col gap-1.5">{bar("w-24", "bg-edge-strong")}{bar("w-12")}</span><span className="h-2 w-12 rounded-full bg-ink/80" /></div>
      <div className="flex items-center gap-2 rounded-md bg-white p-2.5 ring-2 ring-accent"><CardIcon className="size-4 text-accent" /><span className="text-[11px] font-bold text-ink">Card</span><span className="ml-auto size-3 rounded-full border-[3px] border-accent" /></div>
      <div className="flex items-center gap-2 rounded-md bg-white p-2.5"><PhoneIcon className="size-4 text-cyan" /><span className="text-[11px] font-bold text-ink">Mobile money</span><span className="ml-auto size-3 rounded-full border border-edge-strong" /></div>
      <div className="mt-1 flex h-8 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white">Pay securely</div>
    </Window>
    <Chip className="-right-6 top-10"><span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckIcon className="size-2.5" /></span> Payment received</Chip>
  </>,
  // Learn and build
  <>
    <Window label="Live class">
      <div className="grid grid-cols-2 gap-2">
        {["bg-accent-soft text-accent", "bg-cyan/15 text-cyan", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700"].map((tone, i) => (
          <div key={tone} className="flex aspect-[4/3] items-center justify-center rounded-md bg-white">
            <span className={`flex size-8 items-center justify-center rounded-full text-[10px] font-bold ${tone}`}>{["AO", "KM", "TB", "IE"][i]}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-3 text-[10px] font-bold text-white"><VideoIcon className="size-3.5" /> Join now</span>
      </div>
    </Window>
    <Chip className="-left-10 -top-6"><BellIcon className="size-4 text-amber-500" /> Class starts in 1 hour</Chip>
  </>,
  // Get feedback
  <>
    <Window label="Assignment">
      <div className="flex items-center justify-between rounded-md bg-white p-2.5">
        <span className="flex flex-col gap-1.5">{bar("w-24", "bg-edge-strong")}{bar("w-16")}</span>
        <span className="rounded-md bg-emerald-50 px-2 py-1 font-display text-sm font-bold text-emerald-700">92<span className="text-[10px] text-emerald-700/70">/100</span></span>
      </div>
      <div className="flex gap-2 rounded-md bg-white p-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-bold text-accent">IN</span>
        <span className="flex flex-col gap-1.5 pt-1">{bar("w-40", "bg-edge-strong")}{bar("w-36")}{bar("w-24")}</span>
      </div>
    </Window>
    <Chip className="-bottom-6 -right-10"><MessageIcon className="size-4 text-accent" /> New feedback from your instructor</Chip>
  </>,
];

/** "How it works": the steps on one side, and an illustration of each step on the other, moving on by itself. */
export function HowItWorks({ steps }: { steps: Step[] }) {
  const [index, setIndex] = useState(0);
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
      <ol className="group/steps flex flex-col gap-2">
        {steps.map((step, i) => {
          const active = i === index;
          return (
            <li key={step.title}>
              <button type="button" onClick={() => setIndex(i)} aria-current={active ? "step" : undefined} className={`flex w-full cursor-pointer gap-4 rounded-[14px] border p-5 text-left transition ${active ? "border-edge bg-white shadow-[0_20px_45px_-30px_rgba(24,19,64,.45)]" : "border-transparent hover:bg-white/60"}`}>
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold transition ${active ? "bg-accent text-white" : "bg-accent-soft text-accent"}`}>0{i + 1}</span>
                <span className="flex min-w-0 grow flex-col gap-1.5">
                  <span className="font-display text-lg font-bold text-ink">{step.title}</span>
                  <span className={`text-[15px] leading-relaxed text-muted ${active ? "" : "line-clamp-1 lg:line-clamp-none"}`}>{step.text}</span>
                  {active && (
                    <span className="mt-2 block h-1 overflow-hidden rounded-full bg-accent-soft">
                      {/* The bar filling up moves the section on to the next step; hovering the list pauses it. */}
                      <span key={index} onAnimationEnd={() => setIndex((index + 1) % steps.length)} className="step-progress block h-full rounded-full bg-accent group-hover/steps:[animation-play-state:paused]" />
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="relative order-first flex items-center justify-center overflow-hidden rounded-[24px] border border-accent/10 bg-[#f1efff] px-6 py-12 sm:py-16 lg:order-none">
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/15" />
        {/* Drawn at 420×320 and scaled down on narrow screens; the outer box reserves the scaled size. */}
        <div aria-hidden="true" className="relative h-[229px] w-[300px] sm:h-[320px] sm:w-[420px]">
          <div className="absolute left-0 top-0 flex h-[320px] w-[420px] origin-top-left scale-[.714] items-center justify-center sm:scale-100">
            <div key={index} className="scene-in relative">{SCENES[index]}</div>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">Step {index + 1}: {steps[index]?.title}</p>
      </div>
    </div>
  );
}
