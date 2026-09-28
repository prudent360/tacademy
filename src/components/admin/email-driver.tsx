"use client";

import type { EmailDriver } from "@/db/schema";
import { ChoicePanels } from "./choice-panels";

const DRIVERS: { value: EmailDriver; label: string }[] = [
  { value: "resend", label: "Resend" },
  { value: "smtp", label: "SMTP" },
  { value: "log", label: "Log only" },
];

/** Picks how email is sent; the other driver's saved credentials are kept. */
export function EmailDriverFields({ initial, resend, smtp, log }: { initial: EmailDriver; resend: React.ReactNode; smtp: React.ReactNode; log: React.ReactNode }) {
  return <ChoicePanels name="driver" legend="Mail driver" options={DRIVERS} initial={initial} panels={{ resend, smtp, log }} />;
}
