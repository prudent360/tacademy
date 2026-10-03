"use client";

import { useActionState, useRef } from "react";
import type { FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/** A role dropdown that saves as soon as it changes. */
export function RoleSelect({ action, current, roles, label }: { action: Action; current: string; roles: { value: string; label: string }[]; label: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={formAction} className="flex flex-col gap-1">
      <select
        name="role"
        defaultValue={current}
        aria-label={label}
        disabled={pending}
        onChange={() => form.current?.requestSubmit()}
        className="h-9 w-full min-w-[170px] cursor-pointer rounded-[5px] border border-edge-strong bg-surface px-2.5 text-sm font-semibold text-ink focus:border-accent focus:outline-none disabled:opacity-60"
      >
        {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
      {state?.ok && !pending && <span className="text-xs text-emerald-700">Saved</span>}
    </form>
  );
}
