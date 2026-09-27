"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Live countdown blocks (days / hours / minutes / seconds) to a class start time. */
export function Countdown({ to, startedLabel = "Happening now" }: { to: string; startedLabel?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  if (now !== null && now >= target) return <span className="inline-flex h-9 items-center rounded-lg bg-emerald-400/20 px-3 text-sm font-bold text-emerald-200">{startedLabel}</span>;
  const p = parts(now === null ? 0 : target - now);
  const blocks: [number, string][] = [[p.d, "D"], [p.h, "H"], [p.m, "M"], [p.s, "S"]];
  return (
    <span className="flex items-center gap-1.5" role="timer" aria-label="Time until class starts">
      {blocks.map(([value, unit]) => (
        <span key={unit} className="flex items-baseline gap-0.5">
          <span className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-white/15 px-1.5 font-display text-lg font-bold tabular-nums text-white">
            {now === null ? "--" : String(value).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-semibold text-white/60">{unit}</span>
        </span>
      ))}
    </span>
  );
}
