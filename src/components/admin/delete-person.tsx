"use client";

import { useState, useTransition } from "react";
import { deletePerson } from "@/app/actions/people";

/** Two-step delete on a person's page; the server refuses when they have records to keep. */
export function DeletePersonButton({ id, name }: { id: number; name: string }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {armed ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} onClick={() => startTransition(async () => setError((await deletePerson(id))?.error ?? ""))} className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-70">
            {pending ? "Deleting…" : `Yes, delete ${name}`}
          </button>
          <button type="button" onClick={() => setArmed(false)} className="inline-flex h-10 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setArmed(true)} className="inline-flex h-10 w-fit cursor-pointer items-center rounded-lg border border-edge-strong px-4 text-sm font-semibold text-red-700 hover:border-red-300 hover:bg-red-50">Delete account</button>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
