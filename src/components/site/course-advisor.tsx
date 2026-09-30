"use client";

import { useState } from "react";
import { askAdvisor } from "@/app/actions/ai";
import { AiChat } from "@/components/ai/chat";
import { SparkIcon, XIcon } from "@/components/icons";

/** Floating "Find your course" chat on the public site. */
export function CourseAdvisor() {
  const [open, setOpen] = useState(false);
  return (
    <div className="course-advisor fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section aria-label="Course advisor" className="flex w-[calc(100vw-2rem)] max-w-[380px] flex-col gap-3 rounded-[16px] border border-edge bg-white p-4 shadow-[0_30px_80px_-30px_rgba(25,17,46,.55)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-base font-bold text-ink">Find your course</p>
              <p className="text-xs text-muted">Tell us your goals and we&apos;ll suggest a programme.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-page hover:text-ink" aria-label="Close course advisor"><XIcon className="size-4" /></button>
          </div>
          <AiChat
            send={askAdvisor}
            intro="Hi! What would you like to achieve? For example, a new career in data, or skills for your current job."
            placeholder="Tell us about your goals…"
            suggestions={["I'm a complete beginner", "I want a job in data", "What internships do you have?"]}
          />
        </section>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex h-12 cursor-pointer items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-[0_14px_32px_-12px_rgba(113,52,217,.9)] transition hover:-translate-y-0.5 hover:bg-accent-dark">
        {open ? <XIcon className="size-4" /> : <SparkIcon className="size-4" />} {open ? "Close" : "Find your course"}
      </button>
    </div>
  );
}
