"use client";

import { useState } from "react";

/** Read-only value with a copy button, e.g. a webhook URL. `multiline` shows longer text in full. */
export function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <div className={`flex gap-2 ${multiline ? "items-start" : ""}`}>
        {multiline
          ? <textarea readOnly value={value} aria-label={label} rows={value.split("\n").length + 2} className="w-full min-w-0 resize-none rounded-lg border border-edge bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-body" onFocus={(e) => e.currentTarget.select()} />
          : <input readOnly value={value} aria-label={label} className="h-11 w-full min-w-0 rounded-lg border border-edge bg-panel px-3 font-mono text-[13px] text-body" onFocus={(e) => e.currentTarget.select()} />}
        <button
          type="button"
          onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="h-11 shrink-0 cursor-pointer rounded-lg border border-edge-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-page"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
