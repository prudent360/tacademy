import "server-only";
import { getDb } from "@/db";
import { whatsappLog, type WhatsAppSettings } from "@/db/schema";
import { getSettings } from "./data";
import { decryptSecret } from "./secrets";
import type { WhatsAppTemplate } from "./whatsapp-templates";

/** Meta Graph API version. Each version is supported for at least two years. */
const GRAPH = "https://graph.facebook.com/v23.0";

export type ResolvedWhatsApp = WhatsAppSettings & { ready: boolean };

export async function whatsappConfig(): Promise<ResolvedWhatsApp> {
  const saved: Partial<WhatsAppSettings> = (await getSettings()).whatsapp ?? {};
  const accessToken = decryptSecret(saved.accessToken);
  const phoneNumberId = saved.phoneNumberId ?? "";
  const enabled = saved.enabled === true;
  return { enabled, phoneNumberId, accessToken, language: saved.language || "en", ready: enabled && Boolean(phoneNumberId && accessToken) };
}

/** "+234 803 123 4567" → "2348031234567". Null when it can't be a full international number. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/^\s*00/, "+").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export type OutgoingWhatsApp = { to: string; template: WhatsAppTemplate | "hello_world"; params: string[] };

/** WhatsApp rejects new lines, tabs and runs of spaces inside parameters, and caps their length. */
const clean = (v: string) => v.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 1000) || "-";

async function sendOne(cfg: ResolvedWhatsApp, message: OutgoingWhatsApp): Promise<{ id?: string; error?: string }> {
  const template = message.template === "hello_world"
    // Meta's ready-made test template, available on every new account.
    ? { name: "hello_world", language: { code: "en_US" } }
    : { name: message.template, language: { code: cfg.language }, components: [{ type: "body", parameters: message.params.map((text) => ({ type: "text", text: clean(text) })) }] };
  try {
    const response = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: message.to, type: "template", template }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await response.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; error_data?: { details?: string } } };
    if (!response.ok) return { error: data.error?.error_data?.details || data.error?.message || `WhatsApp returned ${response.status}` };
    return { id: data.messages?.[0]?.id };
  } catch (error) {
    return { error: error instanceof Error && error.name === "TimeoutError" ? "WhatsApp didn't respond in time" : "Couldn't reach WhatsApp" };
  }
}

/**
 * Sends WhatsApp template messages and logs each one. Does nothing when WhatsApp is switched off or not set up,
 * so callers can always call it. Never throws: a failed message mustn't stop the email or the rest of the run.
 */
export async function sendWhatsApp(messages: OutgoingWhatsApp[]): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  if (!messages.length) return result;
  const cfg = await whatsappConfig();
  if (!cfg.ready) return result;
  const db = await getDb();
  // A few at a time, well inside Meta's rate limits.
  for (let i = 0; i < messages.length; i += 5) {
    const batch = messages.slice(i, i + 5);
    const outcomes = await Promise.all(batch.map((m) => sendOne(cfg, m)));
    await db.insert(whatsappLog).values(batch.map((m, j) => ({
      to: m.to,
      template: m.template,
      params: m.params,
      status: outcomes[j].error ? ("failed" as const) : ("sent" as const),
      error: outcomes[j].error ?? null,
      providerId: outcomes[j].id ?? null,
    })));
    for (const o of outcomes) result[o.error ? "failed" : "sent"]++;
  }
  return result;
}

/** The connection test from Settings: Meta's hello_world template, which needs no approval. */
export async function sendWhatsAppTest(to: string): Promise<{ error?: string }> {
  const cfg = await whatsappConfig();
  if (!cfg.phoneNumberId || !cfg.accessToken) return { error: "Save the phone number ID and access token first." };
  const outcome = await sendOne({ ...cfg, ready: true }, { to, template: "hello_world", params: [] });
  await (await getDb()).insert(whatsappLog).values({ to, template: "hello_world", params: [], status: outcome.error ? "failed" : "sent", error: outcome.error ?? null, providerId: outcome.id ?? null });
  return outcome.error ? { error: outcome.error } : {};
}
