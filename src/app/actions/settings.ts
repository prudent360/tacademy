"use server";


import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { settings, type GatewaySettings, type Settings } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { AI_MODELS, AI_PROVIDERS, DEFAULT_AI, DEFAULT_MODEL, pingAi } from "@/lib/ai";
import { DEFAULT_BANK, DEFAULT_REMINDERS } from "@/lib/config";
import { detectTransactpayCurrencies } from "@/lib/payments";
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

/** A TransactPay encryption key is base64 of an RSA key in XML ("4096!<RSAKeyValue>…"). */
function checkTransactpayKey(value: FormDataEntryValue | null, label: string): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const decoded = Buffer.from(v, "base64").toString("utf8");
  return decoded.includes("<Modulus>") && decoded.includes("<Exponent>") ? null : `${label} doesn't look right. Copy the whole Encryption Key from TransactPay → Settings → API Keys & Webhooks.`;
}

const DEFAULT_GATEWAY_FOR_TRANSACTPAY: GatewaySettings = { enabled: false, mode: "test", testPublicKey: "", testSecretKey: "", livePublicKey: "", liveSecretKey: "" };

function gatewayFrom(formData: FormData, prefix: "stripe" | "paystack" | "pawapay" | "transactpay", existing: Partial<GatewaySettings> | undefined): GatewaySettings {
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
    ...(prefix === "transactpay"
      ? {
          // The box shows the saved key, so what's submitted is the key (emptying it removes it).
          testEncryptionKey: formData.has("transactpayTestEncryptionKey") ? String(formData.get("transactpayTestEncryptionKey")).trim() : existing?.testEncryptionKey ?? "",
          liveEncryptionKey: formData.has("transactpayLiveEncryptionKey") ? String(formData.get("transactpayLiveEncryptionKey")).trim() : existing?.liveEncryptionKey ?? "",
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
    checkTransactpayKey(formData.get("transactpayTestEncryptionKey"), "The TransactPay test encryption key"),
    checkTransactpayKey(formData.get("transactpayLiveEncryptionKey"), "The TransactPay live encryption key"),
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
  const transactpay = gatewayFrom(formData, "transactpay", current.transactpay);
  // Keep what was found on the account, unless the keys for that mode changed.
  const before = current.transactpay;
  for (const m of ["test", "live"] as const) {
    const cap = m === "test" ? "Test" : "Live";
    const changed = String(formData.get(`transactpay${cap}SecretKey`) ?? "").trim() !== "" || transactpay[`${m}PublicKey`] !== (before?.[`${m}PublicKey`] ?? "") || transactpay[`${m}EncryptionKey`] !== (before?.[`${m}EncryptionKey`] ?? "");
    if (!changed && before?.[`${m}Currencies`]) Object.assign(transactpay, { [`${m}Currencies`]: before[`${m}Currencies`], [`${m}CheckedAt`]: before[`${m}CheckedAt`] });
  }
  // New keys (or none checked yet): ask TransactPay which currencies the account takes, for the selected mode.
  const m = transactpay.mode;
  const keys = { publicKey: transactpay[`${m}PublicKey`], encryptionKey: transactpay[`${m}EncryptionKey`] ?? "" };
  let note = "";
  if (transactpay.enabled && keys.publicKey && keys.encryptionKey && (transactpay[`${m}SecretKey`] || process.env.TRANSACTPAY_SECRET_KEY) && !transactpay[`${m}Currencies`]) {
    const checked = await detectTransactpayCurrencies(keys);
    if ("error" in checked) note = ` But ${checked.error}`;
    else {
      Object.assign(transactpay, { [`${m}Currencies`]: checked.currencies, [`${m}CheckedAt`]: new Date().toISOString() });
      note = ` TransactPay takes: ${checked.currencies.join(", ")}.`;
    }
  }
  await update({ payment: { stripe, paystack, pawapay, transactpay, bank } });
  return note.startsWith(" But") ? { error: `Payment settings saved.${note}` } : { ok: `Payment settings saved.${note}` };
}

/** "Check again" on the TransactPay settings: asks which currencies the account takes, for the current mode. */
export async function checkTransactpayCurrencies(): Promise<FormState> {
  await requireRole("admin");
  const checked = await detectTransactpayCurrencies();
  if ("error" in checked) return { error: checked.error };
  const payment = (await getSettings()).payment;
  const tp = { ...DEFAULT_GATEWAY_FOR_TRANSACTPAY, ...payment.transactpay };
  await update({ payment: { ...payment, transactpay: { ...tp, [`${tp.mode}Currencies`]: checked.currencies, [`${tp.mode}CheckedAt`]: new Date().toISOString() } } });
  return { ok: `TransactPay takes: ${checked.currencies.join(", ")}.` };
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

// ---------- AI ----------

export async function saveAiSettings(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const current = { ...DEFAULT_AI, ...((await getSettings()).ai ?? {}) };
  const provider = AI_PROVIDERS.find((p) => p.id === formData.get("aiProvider"))?.id ?? "openai";
  // Only the chosen provider's fields are read: the others are hidden but still submitted.
  const problem = provider === "openai"
    ? checkKey(formData.get("openaiApiKey"), ["sk-"], "The OpenAI API key")
    : checkKey(formData.get("aiApiKey"), ["sk-ant-"], "The Anthropic API key");
  if (problem) return { error: problem };
  const pick = (name: string, fallback: string) => {
    const value = String(formData.get(name) ?? "");
    return AI_MODELS[provider].some((m) => m.id === value) ? value : fallback;
  };
  await update({
    ai: {
      ...current,
      enabled: formData.get("aiEnabled") === "on",
      provider,
      ...(provider === "openai"
        ? { openaiApiKey: secretField(formData, "openaiApiKey", current.openaiApiKey), openaiModel: pick("openaiModel", DEFAULT_MODEL.openai) }
        : { apiKey: secretField(formData, "aiApiKey", current.apiKey), model: pick("aiModel", DEFAULT_MODEL.anthropic) }),
      advisor: formData.get("aiAdvisor") === "on",
      studyBuddy: formData.get("aiStudyBuddy") === "on",
      grading: formData.get("aiGrading") === "on",
      writing: formData.get("aiWriting") === "on",
    },
  });
  return { ok: "AI settings saved." };
}

export async function testAiConnection(): Promise<FormState> {
  await requireRole("admin");
  const problem = await pingAi();
  return problem ? { error: problem } : { ok: "Connected: the AI provider replied." };
}

// ---------- SEO ----------

/** Accepts the bare code or the whole <meta ... content="..."> tag that Google and Bing show. */
function verificationCode(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  const fromTag = raw.match(/content=["']([^"']+)["']/i)?.[1];
  return (fromTag ?? raw).replace(/[^A-Za-z0-9_\-.=+/]/g, "").slice(0, 200);
}

export async function saveSeo(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = z.object({
    titleTemplate: text(120),
    homeTitle: text(90),
    homeDescription: text(300),
    defaultDescription: text(300),
    coursesDescription: text(300),
    internshipsDescription: text(300),
  }).safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (parsed.data.titleTemplate && !parsed.data.titleTemplate.includes("%s")) return { error: "The title pattern must include %s where the page name goes, e.g. %s | Tekskillup Academy." };
  const profiles = parseList(formData.get("socialProfiles"), /\n/).slice(0, 10);
  const badProfile = profiles.find((url) => !/^https:\/\/[^\s]+\.[^\s]+$/.test(url));
  if (badProfile) return { error: `Social profiles must be full links starting with https:// (check "${badProfile}").` };
  const handle = String(formData.get("twitterHandle") ?? "").trim().replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, "").replace(/^@/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 15);

  const current = await getSettings();
  let shareImageUrl: string | null;
  try {
    shareImageUrl = await resolveFileField(formData, { file: "shareImage", remove: "removeShareImage", current: current.seo?.shareImageUrl ?? null, folder: "branding" });
  } catch (error) {
    const message = uploadErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }
  await update({
    seo: {
      ...parsed.data,
      shareImageUrl,
      twitterHandle: handle ? `@${handle}` : "",
      googleVerification: verificationCode(formData.get("googleVerification")),
      bingVerification: verificationCode(formData.get("bingVerification")),
      allowIndexing: formData.get("allowIndexing") === "on",
      socialProfiles: profiles,
    },
  });
  await deleteIfReplaced(current.seo?.shareImageUrl ?? null, shareImageUrl);
  return { ok: "SEO settings saved." };
}

// ---------- Video ----------

export async function saveVideoSettings(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const value = String(formData.get("bunnyTokenKey") ?? "").trim();
  if (value && !/^[A-Za-z0-9-]{16,100}$/.test(value)) return { error: "That doesn't look like a Bunny Stream token authentication key. Copy it from Stream → your library → Security." };
  const current = (await getSettings()).video ?? {};
  await update({ video: { bunnyTokenKey: secretField(formData, "bunnyTokenKey", current.bunnyTokenKey) } });
  return { ok: "Video settings saved." };
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

