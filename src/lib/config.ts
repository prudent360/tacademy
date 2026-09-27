import "server-only";
import type { BankTransferSettings, EmailSettings, GatewaySettings, ReminderSettings } from "@/db/schema";
import { getSettings } from "./data";
import { decryptSecret } from "./secrets";

export type Gateway = "stripe" | "paystack";
export type ResolvedGateway = {
  enabled: boolean;
  mode: "test" | "live";
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  /** Where the active secret key comes from, for the settings page. */
  source: "settings" | "environment" | "none";
};

const ENV_SECRET: Record<Gateway, string | undefined> = {
  stripe: process.env.STRIPE_SECRET_KEY,
  paystack: process.env.PAYSTACK_SECRET_KEY,
};

const DEFAULT_GATEWAY: GatewaySettings = { enabled: true, mode: "test", testPublicKey: "", testSecretKey: "", livePublicKey: "", liveSecretKey: "" };

export const DEFAULT_BANK: BankTransferSettings = { enabled: false, accountName: "", bankName: "", accountNumber: "", sortCode: "", currency: "NGN", instructions: "" };
export const DEFAULT_REMINDERS: ReminderSettings = { dayBefore: true, hourBefore: true, hourLeadMinutes: 60, assignmentDue: true, assignmentLeadHours: 24 };

/** Keys saved in Settings > Payments win; otherwise the environment variables are used. */
export async function gatewayConfig(gateway: Gateway): Promise<ResolvedGateway> {
  const saved = { ...DEFAULT_GATEWAY, ...((await getSettings()).payment[gateway] ?? {}) };
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
    source: savedSecret ? "settings" : ENV_SECRET[gateway] ? "environment" : "none",
  };
}

export async function bankTransferConfig(): Promise<BankTransferSettings> {
  return { ...DEFAULT_BANK, ...((await getSettings()).payment.bank ?? {}) };
}

export type ResolvedEmail = { apiKey: string; from: string; replyTo: string; source: "settings" | "environment" | "none" };

export async function emailConfig(): Promise<ResolvedEmail> {
  const settings = await getSettings();
  const saved: Partial<EmailSettings> = settings.email ?? {};
  const savedKey = decryptSecret(saved.apiKey);
  const apiKey = savedKey || process.env.RESEND_API_KEY || "";
  const from = saved.fromAddress
    ? `${saved.fromName || settings.siteName} <${saved.fromAddress}>`
    : process.env.EMAIL_FROM?.trim() || `${settings.siteName} <onboarding@resend.dev>`;
  return { apiKey, from, replyTo: saved.replyTo || settings.supportEmail, source: savedKey ? "settings" : process.env.RESEND_API_KEY ? "environment" : "none" };
}

export async function reminderConfig(): Promise<ReminderSettings> {
  return { ...DEFAULT_REMINDERS, ...((await getSettings()).reminders ?? {}) };
}
