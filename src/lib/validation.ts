import { z } from "zod";

export type FormState = { error?: string; ok?: string } | undefined;

export const text = (max = 200) => z.string().trim().max(max, `Keep this under ${max} characters.`);
export const required = (label: string, max = 200) => text(max).min(1, `${label} is required.`);

/** Empty string or an http(s) URL. Blocks javascript: and other schemes in links. */
export const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Links must start with http:// or https://");

export const optionalEmail = z.string().trim().max(200).refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address.");

export const monthValue = z.string().trim().refine((v) => v === "" || /^\d{4}-(0[1-9]|1[0-2])$/.test(v), "Use a valid month.");
export const yearValue = z.string().trim().refine((v) => v === "" || /^\d{4}$/.test(v), "Use a four-digit year.");
export const sortValue = z.coerce.number().int().min(-9999).max(9999).catch(0);

export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export const nullIfEmpty = (v: string) => (v === "" ? null : v);

export const dateValue = z.string().trim().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date.");
export const dateTimeValue = z.string().trim().refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Use a valid date and time.");
export const optionalDateTime = z.string().trim().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), "Use a valid date and time.");
export const email = z.string().trim().toLowerCase().max(200).pipe(z.email("Enter a valid email address."));

export function idParam(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Only allow same-site relative redirects such as "/dashboard". */
export function safeNext(value: FormDataEntryValue | string | null | undefined): string | null {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;
}
