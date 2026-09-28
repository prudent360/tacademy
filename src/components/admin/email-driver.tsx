"use client";

import { useState } from "react";
import type { EmailDriver } from "@/db/schema";

const DRIVERS: { value: EmailDriver; label: string }[] = [
  { value: "resend", label: "Resend" },
  { value: "smtp", label: "SMTP" },
  { value: "log", label: "Log only" },
];

/**
 * Picks how email is sent. The other driver's fields stay in the form (just hidden),
 * so switching back and forth never loses saved credentials.
 */
export function EmailDriverFields({ initial, resend, smtp, log }: { initial: EmailDriver; resend: React.ReactNode; smtp: React.ReactNode; log: React.ReactNode }) {
  const [driver, setDriver] = useState(initial);
  return (
    <>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink">Mail driver</legend>
        <div className="inline-flex w-fit rounded-lg border border-edge-strong bg-panel p-1">
          {DRIVERS.map((d) => (
            <label key={d.value} className="cursor-pointer rounded-md px-4 py-1.5 text-sm font-semibold text-muted has-[:checked]:bg-white has-[:checked]:text-accent has-[:checked]:shadow-sm">
              <input type="radio" name="driver" value={d.value} checked={driver === d.value} onChange={() => setDriver(d.value)} className="sr-only" />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div hidden={driver !== "resend"} className="flex flex-col gap-5">{resend}</div>
      <div hidden={driver !== "smtp"} className="flex flex-col gap-5">{smtp}</div>
      <div hidden={driver !== "log"} className="flex flex-col gap-5">{log}</div>
    </>
  );
}
