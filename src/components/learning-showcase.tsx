"use client";

import { useEffect, useState } from "react";
import { AwardIcon, BookIcon, VideoIcon } from "@/components/icons";

const SLIDES = [
  { title: "Learn live with your instructor.", text: "Join classes online or in person, and catch the recording if you miss one.", tab: "Live classes" },
  { title: "Lessons at your own pace.", text: "Pick up where you left off, on any device.", tab: "Lessons" },
  { title: "Finish with a certificate.", text: "Feedback on every assignment, and a certificate you can share.", tab: "Progress" },
];

const BUBBLES = [
  { icon: VideoIcon, tone: "text-accent-ink", y: 50 },
  { icon: BookIcon, tone: "text-cyan", y: 150 },
  { icon: AwardIcon, tone: "text-amber-500", y: 250 },
];

const ROWS = [
  { initials: "AO", tone: "bg-accent-soft text-accent-ink", widths: ["w-24", "w-16"] },
  { initials: "KM", tone: "bg-cyan/15 text-cyan", widths: ["w-20", "w-24"] },
  { initials: "TB", tone: "bg-amber-100 text-amber-700", widths: ["w-28", "w-14"] },
];

/** An illustrated panel cycling through what the academy offers. Used beside the sign-in form and on the homepage; sits on a brand-purple background. */
export function LearningShowcase({ className = "px-10 py-14" }: { className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000);
    return () => window.clearInterval(timer);
  }, [index]);

  const slide = SLIDES[index];
  return (
    <div className={`flex h-full flex-col items-center justify-center gap-10 ${className}`}>
      {/* Drawn at 420×320 and scaled down on narrow screens; the outer box reserves the scaled size. */}
      <div aria-hidden="true" className="relative h-[229px] w-[300px] shrink-0 sm:h-[320px] sm:w-[420px]">
      <div className="absolute left-0 top-0 h-[320px] w-[420px] origin-top-left scale-[.714] sm:scale-100">
        <div className="absolute left-1/2 top-1/2 size-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.07]" />
        <div className="absolute left-1/2 top-1/2 size-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <svg viewBox="0 0 420 320" className="absolute inset-0 size-full" fill="none">
          <path d="M68 50H100a22 22 0 0 1 22 22V228a22 22 0 0 1-22 22H68M68 150H200" stroke="rgba(255,255,255,.2)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {BUBBLES.map(({ icon: Icon, tone, y }, i) => (
          <span key={y} className={`absolute left-[40px] flex size-14 items-center justify-center rounded-full bg-surface shadow-[0_10px_30px_-12px_rgba(0,0,0,.45)] ring-[6px] transition duration-500 ${i === index ? "scale-110 ring-white/40" : "ring-white/15"}`} style={{ top: y - 28 }}>
            <Icon className={`size-6 ${tone}`} />
          </span>
        ))}
        <div className="absolute left-[190px] top-[62px] w-[220px] overflow-hidden rounded-[10px] bg-surface shadow-[0_24px_50px_-20px_rgba(8,5,30,.6)]">
          <div className="flex items-center gap-1.5 border-b border-line px-3 py-2.5">
            <span className="size-2 rounded-full bg-red-400" /><span className="size-2 rounded-full bg-amber-400" /><span className="size-2 rounded-full bg-emerald-400" />
            <span className="ml-auto h-1.5 w-12 rounded-full bg-line" />
          </div>
          <div className="flex flex-col gap-2 bg-panel p-3">
            <div className="flex items-center gap-2 pb-1">
              <span className="rounded-md bg-accent-soft px-2 py-1 text-[10px] font-bold text-accent-ink transition">{slide.tab}</span>
              <span className="h-1.5 w-10 rounded-full bg-line" />
            </div>
            {ROWS.map((row) => (
              <div key={row.initials} className="flex items-center gap-2.5 rounded-md bg-surface p-2 shadow-[0_1px_2px_rgba(24,19,64,.06)]">
                <span className={`flex size-7 items-center justify-center rounded-full text-[10px] font-bold ${row.tone}`}>{row.initials}</span>
                <span className="flex flex-col gap-1.5"><span className={`h-1.5 rounded-full bg-edge-strong ${row.widths[0]}`} /><span className={`h-1.5 rounded-full bg-line ${row.widths[1]}`} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      <div className="flex max-w-[380px] flex-col items-center gap-2.5 text-center">
        <p aria-live="polite" className="font-display text-[22px] font-bold leading-snug text-white">{slide.title}</p>
        <p className="text-[15px] text-white/75">{slide.text}</p>
        <div className="mt-5 flex gap-2">
          {SLIDES.map((s, i) => (
            <button key={s.title} type="button" onClick={() => setIndex(i)} aria-label={`Show slide ${i + 1}`} aria-current={i === index} className={`h-2 cursor-pointer rounded-full transition-all ${i === index ? "w-6 bg-surface" : "w-2 bg-white/35 hover:bg-surface/60"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
