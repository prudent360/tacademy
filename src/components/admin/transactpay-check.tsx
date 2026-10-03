"use client";

import { useState, useTransition } from "react";
import { checkTransactpayCurrencies } from "@/app/actions/settings";

/** Re-asks TransactPay which currencies the account takes. A button, not a form, as it sits inside the payments form. */
export function TransactpayCheckButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  return (
    <span className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={pending} onClick={() => start(async () => setResult((await checkTransactpayCurrencies()) ?? null))} className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-edge-strong bg-surface px-3 text-sm font-semibold text-ink hover:border-accent-muted hover:bg-page disabled:cursor-wait disabled:opacity-60">
        {pending ? "Checking…" : "Check again"}
      </button>
      {result?.ok && <span className="text-sm text-emerald-700">{result.ok}</span>}
      {result?.error && <span role="alert" className="text-sm text-red-700">{result.error}</span>}
    </span>
  );
}
