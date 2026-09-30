"use client";

import { useRef, useState } from "react";
import type { AiDraft } from "@/app/actions/ai";
import { SparkIcon } from "@/components/icons";

/**
 * "Draft with AI": sends the surrounding form's current values to `draft` and fills the fields it
 * returns. Nothing is saved; the person reviews the draft and submits the form as usual.
 */
export function AiDraftButton({ draft, label = "Draft with AI", confirmReplace = true, confirmFields }: { draft: (values: Record<string, string>) => Promise<AiDraft>; label?: string; confirmReplace?: boolean; confirmFields?: string[] }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<{ busy: boolean; error?: string; done?: boolean }>({ busy: false });

  async function run() {
    const form = ref.current?.form;
    if (!form) return;
    const values: Record<string, string> = {};
    for (const [name, value] of new FormData(form)) if (typeof value === "string") values[name] = value;
    setState({ busy: true });
    const result = await draft(values).catch(() => ({ error: "The assistant is unavailable right now." }));
    if ("error" in result) return setState({ busy: false, error: result.error });
    const fields = Object.entries(result.fields).map(([name, value]) => [form.elements.namedItem(name), value] as const);
    const filled = fields.filter(([el]) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) as [HTMLInputElement | HTMLTextAreaElement, string][];
    // Only ask before overwriting writing (not, say, a number field that always has a default).
    const matters = filled.filter(([el]) => !confirmFields || confirmFields.includes(el.name));
    if (confirmReplace && matters.some(([el]) => el.value.trim()) && !window.confirm("Replace what's already written with the AI draft?")) return setState({ busy: false });
    for (const [el, value] of filled) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    filled[0]?.[0].focus();
    setState({ busy: false, done: true });
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button ref={ref} type="button" onClick={run} disabled={state.busy} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-accent-muted/70 bg-accent-soft px-3 text-xs font-semibold text-accent transition hover:border-accent disabled:cursor-wait disabled:opacity-70">
        <SparkIcon className="size-3.5" /> {state.busy ? "Drafting…" : label}
      </button>
      {state.error && <span role="alert" className="text-xs text-red-700">{state.error}</span>}
      {state.done && !state.error && <span className="text-xs text-muted">Draft added: review and edit before saving.</span>}
    </span>
  );
}
