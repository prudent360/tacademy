"use client";

import { useEffect, useRef, useState } from "react";
import { ClockIcon } from "@/components/icons";

/** Counts down to the deadline and submits the quiz form when time runs out. */
export function QuizTimer({ deadline, formId }: { deadline: string; formId: string }) {
  const end = new Date(deadline).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  const submitted = useRef(false);
  useEffect(() => {
    const tick = setInterval(() => {
      const remaining = Math.max(0, end - Date.now());
      setLeft(remaining);
      if (remaining === 0 && !submitted.current) {
        submitted.current = true;
        (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [end, formId]);
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  return (
    <span role="timer" aria-live="off" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-sm font-semibold ${left < 60_000 ? "bg-red-50 text-red-700" : "bg-accent-soft text-accent"}`}>
      <ClockIcon className="size-4" /> {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
