"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "@/components/icons";

const field = "h-12 w-full rounded-[8px] border border-edge bg-panel pl-11 pr-3.5 text-[15px] text-ink transition placeholder:text-[#878598] hover:border-accent-muted focus:border-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent/10";

/** Email input with a leading icon, for the sign-in and account pages. */
export function EmailField({ label = "Email address", name = "email", autoComplete = "username" }: { label?: string; name?: string; autoComplete?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <div className="relative">
        <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input id={id} name={name} type="email" autoComplete={autoComplete} required placeholder="you@example.com" className={field} />
      </div>
    </div>
  );
}

/** Password input with a leading icon and a show/hide toggle. */
export function PasswordField({ label = "Password", name = "password", autoComplete = "current-password", minLength, hint }: { label?: string; name?: string; autoComplete?: string; minLength?: number; hint?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <div className="relative">
        <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} placeholder="••••••••" aria-describedby={hint ? `${id}-hint` : undefined} className={`${field} pr-12`} />
        <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-page hover:text-ink">
          {visible ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
        </button>
      </div>
      {hint && <p id={`${id}-hint`} className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}
