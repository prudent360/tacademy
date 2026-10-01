import "server-only";
import type { BankTransferSettings, EmailDriver, EmailSettings, GatewaySettings, ReminderSettings } from "@/db/schema";
import { getSettings } from "./data";
import { decryptSecret } from "./secrets";

export type Gateway = "stripe" | "paystack" | "transactpay";
export type ResolvedGateway = {
  enabled: boolean;
  mode: "test" | "live";
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  /** TransactPay only: the RSA key its requests are encrypted with. */
  encryptionKey: string;
  /** TransactPay only: currencies found on the account for this mode (null until checked), and when. */
  currencies: string[] | null;
  checkedAt: string | null;
  /** Where the active secret key comes from, for the settings page. */
  source: "settings" | "environment" | "none";
};

const ENV_SECRET: Record<Gateway, string | undefined> = {
  stripe: process.env.STRIPE_SECRET_KEY,
  paystack: process.env.PAYSTACK_SECRET_KEY,
  transactpay: process.env.TRANSACTPAY_SECRET_KEY,
};

const DEFAULT_GATEWAY: GatewaySettings = { enabled: true, mode: "test", testPublicKey: "", testSecretKey: "", livePublicKey: "", liveSecretKey: "" };

export const DEFAULT_BANK: BankTransferSettings = { enabled: false, accountName: "", bankName: "", accountNumber: "", sortCode: "", currency: "NGN", instructions: "" };
export const DEFAULT_REMINDERS: ReminderSettings = { dayBefore: true, hourBefore: true, hourLeadMinutes: 60, assignmentDue: true, assignmentLeadHours: 24 };

/** Keys saved in Settings > Payments win; otherwise the environment variables are used. */
export async function gatewayConfig(gateway: Gateway): Promise<ResolvedGateway> {
  // TransactPay is opt-in: until it's switched on, naira payments stay with Paystack.
  const defaults = gateway === "transactpay" ? { ...DEFAULT_GATEWAY, enabled: false } : DEFAULT_GATEWAY;
  const saved = { ...defaults, ...((await getSettings()).payment[gateway] ?? {}) };
  const live = saved.mode === "live";
  const savedSecret = decryptSecret(live ? saved.liveSecretKey : saved.testSecretKey);
  const secretKey = savedSecret || ENV_SECRET[gateway] || "";
  const webhookSecret =
    gateway === "stripe" ? decryptSecret(live ? saved.liveWebhookSecret : saved.testWebhookSecret) || process.env.STRIPE_WEBHOOK_SECRET || "" : secretKey;
  return {
    enabled: saved.enabled,
    mode: saved.mode,
    secretKey,
    publicKey: live ? saved.livePublicKey : saved.testPublicKey,
    webhookSecret,
    encryptionKey: (live ? saved.liveEncryptionKey : saved.testEncryptionKey) ?? "",
    currencies: (live ? saved.liveCurrencies : saved.testCurrencies) ?? null,
    checkedAt: (live ? saved.liveCheckedAt : saved.testCheckedAt) ?? null,
    source: savedSecret ? "settings" : ENV_SECRET[gateway] ? "environment" : "none",
  };
}

export async function bankTransferConfig(): Promise<BankTransferSettings> {
  return { ...DEFAULT_BANK, ...((await getSettings()).payment.bank ?? {}) };
}

export type ResolvedSmtp = { host: string; port: number; security: EmailSettings["smtpSecurity"]; user: string; password: string };
export type ResolvedEmail = {
  driver: EmailDriver;
  /** True when the chosen driver has what it needs to deliver; otherwise emails are only logged. */
  ready: boolean;
  apiKey: string;
  smtp: ResolvedSmtp;
  from: string;
  replyTo: string;
  /** Where the Resend key comes from, for the settings page. */
  source: "settings" | "environment" | "none";
};

export async function emailConfig(): Promise<ResolvedEmail> {
  const settings = await getSettings();
  const saved: Partial<EmailSettings> = settings.email ?? {};
  const savedKey = decryptSecret(saved.apiKey);
  const apiKey = savedKey || process.env.RESEND_API_KEY || "";
  const driver = saved.driver ?? "resend";
  const smtp: ResolvedSmtp = { host: saved.smtpHost ?? "", port: saved.smtpPort ?? 465, security: saved.smtpSecurity ?? "ssl", user: saved.smtpUser ?? "", password: decryptSecret(saved.smtpPassword) };
  const ready = driver === "resend" ? Boolean(apiKey) : driver === "smtp" ? Boolean(smtp.host && smtp.user && smtp.password) : false;
  const from = saved.fromAddress
    ? `${saved.fromName || settings.siteName} <${saved.fromAddress}>`
    : process.env.EMAIL_FROM?.trim() || (driver === "smtp" && smtp.user.includes("@") ? `${settings.siteName} <${smtp.user}>` : `${settings.siteName} <onboarding@resend.dev>`);
  return { driver, ready, apiKey, smtp, from, replyTo: saved.replyTo || settings.supportEmail, source: savedKey ? "settings" : process.env.RESEND_API_KEY ? "environment" : "none" };
}

export async function reminderConfig(): Promise<ReminderSettings> {
  return { ...DEFAULT_REMINDERS, ...((await getSettings()).reminders ?? {}) };
}
