"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef, useState, useTransition } from "react";
import type { FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const PendingContext = createContext(false);

/**
 * A form bound to a server action that shows its error or success message.
 * Submits manually so React does not reset what the user typed when validation fails.
 */
export function ActionForm({
  action,
  children,
  className = "flex flex-col gap-5",
  resetOnSuccess = false,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!state?.ok || !form) return;
    if (resetOnSuccess) form.reset();
    // Clear chosen files so saving again does not re-upload them.
    form.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => { input.value = ""; });
  }, [state, resetOnSuccess]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <PendingContext.Provider value={pending}>
      <form ref={formRef} onSubmit={onSubmit} className={className} aria-busy={pending}>
        {children}
        <div aria-live="polite" className="empty:hidden">
          {!pending && state?.error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
          {!pending && state?.ok && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.ok}</p>}
        </div>
      </form>
    </PendingContext.Provider>
  );
}

export function SubmitButton({ children = "Save", pendingText = "Saving…", block = false }: { children?: React.ReactNode; pendingText?: string; block?: boolean }) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" disabled={pending} className={`inline-flex h-11 ${block ? "w-full" : "w-fit"} cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-6 text-[15px] font-semibold text-white hover:bg-accent-dark disabled:cursor-wait disabled:opacity-70`}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Two-step delete: the first click asks for confirmation. */
export function DeleteButton({ action, label = "Delete" }: { action: () => Promise<void>; label?: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-edge-strong px-4 text-sm font-semibold text-red-700 hover:border-red-300 hover:bg-red-50">
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={async () => { setPending(true); await action(); setPending(false); setArmed(false); }}
        className="inline-flex h-11 cursor-pointer items-center rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-70"
      >
        {pending ? "Deleting…" : "Confirm delete"}
      </button>
      <button type="button" onClick={() => setArmed(false)} className="inline-flex h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink">
        Cancel
      </button>
    </span>
  );
}

const inputClass = "w-full rounded-[5px] border border-edge-strong bg-white px-3.5 py-2.5 text-[15px] text-ink shadow-[0_1px_2px_rgba(25,17,46,.02)] transition placeholder:text-[#8b8598] hover:border-accent-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10";

type FieldProps = { label: string; name: string; hint?: string; className?: string };

function FieldShell({ label, hint, id, className, children }: { label: string; hint?: string; id: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

export function Input({ label, name, hint, className, ...props }: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id} className={className}>
      <input id={id} name={name} aria-describedby={hint ? `${id}-hint` : undefined} className={inputClass} {...props} />
    </FieldShell>
  );
}

export function Textarea({ label, name, hint, className, ...props }: FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id} className={className}>
      <textarea id={id} name={name} aria-describedby={hint ? `${id}-hint` : undefined} className={`${inputClass} min-h-24 leading-relaxed`} {...props} />
    </FieldShell>
  );
}

export function Select({ label, name, hint, className, options, ...props }: FieldProps & { options: { value: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id} className={className}>
      <select id={id} name={name} className={inputClass} {...props}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldShell>
  );
}

export function Checkbox({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-5 cursor-pointer accent-accent" />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-ink">{label}</label>
        {hint && <p className="text-[13px] text-muted">{hint}</p>}
      </div>
    </div>
  );
}

/** File picker that shows the current file and lets the admin remove it. */
export function FileField({ label, name, current, accept = "image/*", hint, removeName }: { label: string; name: string; current?: string | null; accept?: string; hint?: string; removeName: string }) {
  const id = useId();
  const isImage = accept.startsWith("image");
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
      {current && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-edge bg-panel p-3">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current} alt="" className="h-16 w-24 rounded-md object-cover" />
          ) : (
            <a href={current} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent underline">View current file</a>
          )}
          <Checkbox label="Remove" name={removeName} />
        </div>
      )}
      <input id={id} type="file" name={name} accept={accept} className="text-sm text-body file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent-soft file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-accent hover:file:bg-[#e6dafa]" />
      <p className="text-[13px] text-muted">{hint ?? (isImage ? "JPG, PNG, WebP, GIF or AVIF, up to 4 MB." : "PDF, Office, image, ZIP or text file, up to 4 MB.")}</p>
    </div>
  );
}

/** A plain server-action button (e.g. "Mark all read") with a pending and done state. */
export function ActionButton({ action, children, pendingText, doneText, variant = "secondary" }: { action: () => Promise<void>; children: React.ReactNode; pendingText?: string; doneText?: string; variant?: "primary" | "secondary" | "danger" }) {
  const [pending, startTransitionLocal] = useTransition();
  const [done, setDone] = useState(false);
  const styles = {
    primary: "bg-accent text-white hover:bg-accent-dark",
    secondary: "border border-edge-strong bg-white text-ink hover:bg-page",
    danger: "border border-edge-strong bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
  }[variant];
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransitionLocal(async () => {
        await action();
        if (doneText) {
          setDone(true);
          setTimeout(() => setDone(false), 4000);
        }
      })}
      className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-70 ${styles}`}
    >
      {pending ? pendingText ?? "Working…" : done ? doneText : children}
    </button>
  );
}

/** On/off switch that submits "on" like a checkbox. */
export function Switch({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: React.ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-edge bg-panel p-4">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-edge-strong transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/**
 * Field for an API key. The saved value is never sent to the browser; the placeholder shows
 * a masked version, leaving the field empty keeps it, and "Remove" clears it.
 */
export function SecretInput({ label, name, masked, hint, placeholder }: { label: string; name: string; masked?: string; hint?: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
        {label}
        {masked && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Saved</span>}
      </label>
      <input id={id} name={name} type="password" autoComplete="new-password" spellCheck={false} placeholder={masked || placeholder || "Not set"} className={`${inputClass} font-mono text-sm`} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted">{hint ?? (masked ? "Leave blank to keep the saved key." : "Paste the key from your dashboard.")}</p>
        {masked && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-red-700">
            <input type="checkbox" name={`${name}__clear`} className="size-3.5 accent-red-700" /> Remove
          </label>
        )}
      </div>
    </div>
  );
}

/** Button that opens its children in a modal dialog. */
export function ModalButton({ label, title, children, variant = "primary", icon }: { label: string; title: string; children: React.ReactNode; variant?: "primary" | "secondary"; icon?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const styles = variant === "primary" ? "bg-accent text-white hover:bg-accent-dark" : "border border-edge-strong bg-white text-ink hover:bg-page";
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-semibold ${styles}`}>
        {icon}{label}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-[18px] border border-edge bg-white p-0 text-left shadow-2xl backdrop:bg-navy/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-page hover:text-ink">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="max-h-[75dvh] overflow-y-auto p-6">{children}</div>
      </dialog>
    </>
  );
}
