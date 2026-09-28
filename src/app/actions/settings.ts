"use server";


import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { settings, type GatewaySettings, type Settings } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DEFAULT_BANK, DEFAULT_REMINDERS } from "@/lib/config";
import { getSettings } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { CURRENCY_CODES } from "@/lib/money";
import { sendDueReminders } from "@/lib/reminders";
import { encryptSecret } from "@/lib/secrets";
import { deleteIfReplaced } from "@/lib/storage";
import { isValidTimeZone } from "@/lib/time";
import { resolveFileField, uploadErrorMessage } from "@/lib/upload-field";
import { firstName, parseList } from "@/lib/utils";
import { firstError, formValues, optionalEmail, required, text, type FormState } from "@/lib/validation";

async function update(values: Partial<Settings>) {
  const db = await getDb();
  const set = { ...values, updatedAt: new Date() };
  await db.insert(settings).values({ id: 1, ...set }).onConflictDoUpdate({ target: settings.id, set });
  revalidatePath("/", "layout");
}

// ---------- General ----------

const generalSchema = z.object({
  siteName: required("Academy name", 80),
  tagline: text(240),
  supportEmail: optionalEmail,
  phone: text(40),
  address: text(240),
  timezone: text(60).refine(isValidTimeZone, "Use a valid timezone such as Europe/London or Africa/Lagos."),
});

export async function saveGeneral(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = generalSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const currencies = formData.getAll("currencies").map(String).filter((c) => CURRENCY_CODES.includes(c));
  if (!currencies.length) return { error: "Choose at least one currency." };
  const primary = String(formData.get("primaryCurrency") ?? currencies[0]);
  if (!currencies.includes(primary)) return { error: "The main currency must be one of the currencies you accept." };
  await update({ ...parsed.data, currencies: [primary, ...currencies.filter((c) => c !== primary)] });
  return { ok: "General settings saved." };
}

// ---------- Branding & home page ----------

/** "value | label" per line. */
function parsePairs(raw: FormDataEntryValue | null, max: number) {
  return parseList(raw, /\n/).map((line) => line.split("|").map((p) => p.trim())).filter((p) => p[0] && p[1]).slice(0, max);
}

/** Blocks separated by a blank line; the first line is the question, the rest the answer. */
function parseFaqs(raw: FormDataEntryValue | null) {
  return String(raw ?? "")
    .split(/\n\s*\n/)
    .map((block) => block.trim().split("\n"))
    .filter((lines) => lines.length >= 2 && lines[0].trim())
    .map(([question, ...rest]) => ({ question: question.trim(), answer: rest.join(" ").trim() }))
    .slice(0, 20);
}

export async function saveBranding(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = z.object({ heroEyebrow: text(80), heroTitle: text(160), heroSubtitle: text(400) }).safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const current = await getSettings();
  let logoUrl: string | null;
  let heroImageUrl: string | null;
  try {
    logoUrl = await resolveFileField(formData, { file: "logo", remove: "removeLogo", current: current.logoUrl, folder: "branding" });
    heroImageUrl = await resolveFileField(formData, { file: "heroImage", remove: "removeHeroImage", current: current.heroImageUrl, folder: "branding" });
  } catch (error) {
    const message = uploadErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }
  await update({
    ...parsed.data,
    logoUrl,
    heroImageUrl,
    stats: parsePairs(formData.get("stats"), 4).map(([value, label]) => ({ value, label })),
    faqs: parseFaqs(formData.get("faqs")),
    testimonials: parsePairs(formData.get("testimonials"), 6).map(([quote, name, role]) => ({ quote, name, role: role ?? "" })),
  });
  await deleteIfReplaced(current.logoUrl, logoUrl);
  await deleteIfReplaced(current.heroImageUrl, heroImageUrl);
  return { ok: "Branding saved." };
}

// ---------- Payments ----------

/** New value wins, "Remove" clears, otherwise the stored (encrypted) value is kept. */
function secretField(formData: FormData, name: string, existing: string | undefined): string {
  const value = String(formData.get(name) ?? "").trim();
  if (value) return encryptSecret(value);
  if (formData.get(`${name}__clear`) === "on") return "";
  return existing ?? "";
}

function checkKey(value: FormDataEntryValue | null, prefixes: string[], label: string): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return prefixes.some((p) => v.startsWith(p)) ? null : `${label} should start with ${prefixes.join(" or ")}.`;
}

function gatewayFrom(formData: FormData, prefix: "stripe" | "paystack" | "pawapay", existing: Partial<GatewaySettings> | undefined): GatewaySettings {
  return {
    enabled: formData.get(`${prefix}Enabled`) === "on",
    mode: formData.get(`${prefix}Mode`) === "live" ? "live" : "test",
    testPublicKey: String(formData.get(`${prefix}TestPublicKey`) ?? "").trim(),
    livePublicKey: String(formData.get(`${prefix}LivePublicKey`) ?? "").trim(),
    testSecretKey: secretField(formData, `${prefix}TestSecretKey`, existing?.testSecretKey),
    liveSecretKey: secretField(formData, `${prefix}LiveSecretKey`, existing?.liveSecretKey),
    ...(prefix === "stripe"
      ? {
          testWebhookSecret: secretField(formData, "stripeTestWebhookSecret", existing?.testWebhookSecret),
          liveWebhookSecret: secretField(formData, "stripeLiveWebhookSecret", existing?.liveWebhookSecret),
        }
      : {}),
  };
}

export async function savePayments(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const problems = [
    checkKey(formData.get("stripeTestSecretKey"), ["sk_test_", "rk_test_"], "Stripe test secret key"),
    checkKey(formData.get("stripeLiveSecretKey"), ["sk_live_", "rk_live_"], "Stripe live secret key"),
    checkKey(formData.get("stripeTestPublicKey"), ["pk_test_"], "Stripe test publishable key"),
    checkKey(formData.get("stripeLivePublicKey"), ["pk_live_"], "Stripe live publishable key"),
    checkKey(formData.get("stripeTestWebhookSecret"), ["whsec_"], "Stripe webhook signing secret"),
    checkKey(formData.get("stripeLiveWebhookSecret"), ["whsec_"], "Stripe webhook signing secret"),
    checkKey(formData.get("paystackTestSecretKey"), ["sk_test_"], "Paystack test secret key"),
    checkKey(formData.get("paystackLiveSecretKey"), ["sk_live_"], "Paystack live secret key"),
    checkKey(formData.get("paystackTestPublicKey"), ["pk_test_"], "Paystack test public key"),
    checkKey(formData.get("paystackLivePublicKey"), ["pk_live_"], "Paystack live public key"),
    checkKey(formData.get("pawapayTestSecretKey"), ["eyJ"], "The pawaPay sandbox API token"),
    checkKey(formData.get("pawapayLiveSecretKey"), ["eyJ"], "The pawaPay live API token"),
  ].filter(Boolean);
  if (problems.length) return { error: problems[0]! };

  const current = (await getSettings()).payment;
  const bankCurrency = String(formData.get("bankCurrency") ?? "NGN");
  const bank = {
    ...DEFAULT_BANK,
    enabled: formData.get("bankEnabled") === "on",
    accountName: String(formData.get("bankAccountName") ?? "").trim().slice(0, 120),
    bankName: String(formData.get("bankName") ?? "").trim().slice(0, 120),
    accountNumber: String(formData.get("bankAccountNumber") ?? "").trim().slice(0, 40),
    sortCode: String(formData.get("bankSortCode") ?? "").trim().slice(0, 40),
    currency: CURRENCY_CODES.includes(bankCurrency) ? bankCurrency : "NGN",
    instructions: String(formData.get("bankInstructions") ?? "").trim().slice(0, 1000),
  };
  if (bank.enabled && (!bank.accountName || !bank.bankName || !bank.accountNumber)) {
    return { error: "Add the account name, bank and account number to turn on bank transfers." };
  }
  const stripe = gatewayFrom(formData, "stripe", current.stripe);
  const paystack = gatewayFrom(formData, "paystack", current.paystack);
  const pawapay = gatewayFrom(formData, "pawapay", current.pawapay);
  await update({ payment: { stripe, paystack, pawapay, bank } });
  return { ok: "Payment settings saved." };
}

// ---------- Email ----------

const EMAIL_DRIVERS = ["resend", "smtp", "log"] as const;

export async function saveEmailSettings(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = z.object({ fromName: text(80), fromAddress: optionalEmail, replyTo: optionalEmail }).safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const current = (await getSettings()).email;
  const driver = EMAIL_DRIVERS.find((d) => d === formData.get("driver")) ?? "resend";
  // Only the chosen driver's fields are read: the others are hidden but still submitted, and browsers may autofill them.
  const problem = driver === "resend" ? checkKey(formData.get("apiKey"), ["re_"], "The Resend API key") : null;
  if (problem) return { error: problem };
  const smtpPort = Number(formData.get("smtpPort") || 465);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) return { error: "Enter a valid SMTP port, such as 465 or 587." };
  const smtpSecurity = (["ssl", "tls", "none"] as const).find((v) => v === formData.get("smtpSecurity")) ?? "ssl";
  const smtpHost = String(formData.get("smtpHost") ?? "").trim().slice(0, 200);
  const smtpUser = String(formData.get("smtpUser") ?? "").trim().slice(0, 200);
  const smtpPassword = driver === "smtp" ? secretField(formData, "smtpPassword", current.smtpPassword) : current.smtpPassword ?? "";
  if (driver === "smtp" && (!smtpHost || !smtpUser || !smtpPassword)) return { error: "Add the SMTP host, username and password to send with SMTP." };
  await update({ email: { ...parsed.data, driver, apiKey: driver === "resend" ? secretField(formData, "apiKey", current.apiKey) : current.apiKey ?? "", smtpHost, smtpPort, smtpSecurity, smtpUser, smtpPassword } });
  return { ok: "Email settings saved." };
}

export async function sendTestEmailNow(): Promise<void> {
  const admin = await requireRole("admin");
  await sendEmail(admin.email, "verify_email", { name: firstName(admin.name), verifyUrl: "https://example.com/this-is-a-test" });
}

// ---------- Reminders ----------

export async function saveReminders(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const minutes = Number(formData.get("hourLeadMinutes"));
  const hours = Number(formData.get("assignmentLeadHours"));
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 360) return { error: "The class reminder must be between 15 and 360 minutes before." };
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) return { error: "The deadline reminder must be between 1 and 168 hours before." };
  await update({
    reminders: {
      ...DEFAULT_REMINDERS,
      dayBefore: formData.get("dayBefore") === "on",
      hourBefore: formData.get("hourBefore") === "on",
      hourLeadMinutes: minutes,
      assignmentDue: formData.get("assignmentDue") === "on",
      assignmentLeadHours: hours,
    },
  });
  return { ok: "Reminder settings saved." };
}

export async function runRemindersNow(): Promise<FormState> {
  await requireRole("admin");
  const r = await sendDueReminders();
  const total = r.dayReminders + r.hourReminders + r.assignmentReminders;
  return { ok: total ? `Sent ${r.dayReminders} day-before, ${r.hourReminders} class-starting and ${r.assignmentReminders} deadline reminders.` : "Nothing is due right now. Reminders already sent are never repeated." };
}

