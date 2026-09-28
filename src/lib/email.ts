import "server-only";
import { eq } from "drizzle-orm";
import { marked } from "marked";
import nodemailer from "nodemailer";
import { getDb } from "@/db";
import { emailLog, emailTemplates } from "@/db/schema";
import { emailConfig, type ResolvedEmail } from "./config";
import { getSettings } from "./data";
import { COMMON_VARIABLES, EMAIL_TEMPLATES, type TemplateKey } from "./email-templates";
import { absoluteUrl, siteUrl } from "./site";

export type Vars = Record<string, string | number | null | undefined>;
export type OutgoingEmail = { to: string; template: TemplateKey; vars: Vars };

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export async function emailConfigured(): Promise<boolean> {
  return (await emailConfig()).ready;
}

/** Account-security emails can't be switched off. */
export const REQUIRED_TEMPLATES: TemplateKey[] = ["password_reset", "verify_email", "invite", "welcome", "account_setup"];

export async function getTemplate(key: TemplateKey): Promise<{ subject: string; body: string; customised: boolean; enabled: boolean }> {
  const [row] = await (await getDb()).select().from(emailTemplates).where(eq(emailTemplates.key, key));
  const def = EMAIL_TEMPLATES[key];
  if (!row) return { subject: def.subject, body: def.body, customised: false, enabled: true };
  return { subject: row.subject, body: row.body, customised: row.subject !== def.subject || row.body !== def.body, enabled: row.enabled || REQUIRED_TEMPLATES.includes(key) };
}

function fill(template: string, vars: Record<string, string>, escape: boolean): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key] ?? "";
    return escape ? escapeHtml(value) : value;
  });
}

function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:#7134d9"><a href="${url}" style="display:inline-block;padding:13px 24px;font-weight:600;font-size:15px;color:#ffffff;text-decoration:none;border-radius:8px">${label}</a></td></tr></table>`;
}

/** Renders a template to subject, HTML and plain text. */
export async function renderEmail(
  source: { subject: string; body: string },
  vars: Vars,
): Promise<{ subject: string; html: string; text: string }> {
  const settings = await getSettings();
  const all: Record<string, string> = {
    siteName: settings.siteName,
    siteUrl: siteUrl(),
    supportEmail: settings.supportEmail,
    name: "there",
  };
  for (const [key, value] of Object.entries(vars)) if (value !== null && value !== undefined) all[key] = String(value);

  const subject = fill(source.subject, all, false).replace(/\s+/g, " ").trim();
  const withValues = fill(source.body, all, true);
  // [[Label|url]] on its own line becomes a button (an HTML block Markdown passes through).
  const withButtons = withValues.replace(/^\s*\[\[([^|\]]+)\|([^\]]+)\]\]\s*$/gm, (_, label: string, url: string) => `\n${button(label.trim(), url.trim())}\n`);
  const content = await marked.parse(withButtons, { gfm: true, breaks: true });
  const text = fill(source.body, all, false).replace(/^\s*\[\[([^|\]]+)\|([^\]]+)\]\]\s*$/gm, "$1: $2").replace(/\*\*/g, "");

  const brand = escapeHtml(settings.siteName);
  const [firstWord, ...otherWords] = settings.siteName.split(" ");
  const wordmark = `<span style="color:#19112e">${escapeHtml(firstWord)}</span>${otherWords.length ? ` <span style="color:#7134d9;font-weight:600">${escapeHtml(otherWords.join(" "))}</span>` : ""}`;
  const footer = [settings.address, settings.supportEmail].filter(Boolean).map(escapeHtml).join(" · ");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#19112e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6fb;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 8px 20px"><a href="${siteUrl()}" style="font-size:22px;font-weight:800;text-decoration:none;letter-spacing:-0.5px">${wordmark}</a></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e2deeb;border-radius:14px;padding:32px 32px 24px;font-size:16px;line-height:1.65;color:#3d3650">
<style>td p{margin:0 0 16px}td table.content td{padding:6px 12px 6px 0}</style>
${content.replace(/<table>/g, '<table class="content" style="border-collapse:collapse;margin:0 0 16px">')}
</td></tr>
<tr><td style="padding:20px 8px;font-size:13px;line-height:1.6;color:#5e576d">${brand}${footer ? ` · ${footer}` : ""}<br>
<a href="${absoluteUrl("/account")}" style="color:#5e576d">Manage email preferences</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

type Message = { to: string; subject: string; html: string; text: string };
type Delivery = { ok: boolean; ids: (string | null)[]; error?: string };

/** Sends one at a time over a single SMTP connection; the chunk fails as a whole if any message does. */
async function deliverSmtp(cfg: ResolvedEmail, messages: Message[]): Promise<Delivery> {
  const { host, port, security, user, password } = cfg.smtp;
  const transport = nodemailer.createTransport({ host, port, secure: security === "ssl", requireTLS: security === "tls", auth: { user, pass: password }, connectionTimeout: 15_000 });
  const ids: (string | null)[] = [];
  try {
    for (const m of messages) {
      const info = await transport.sendMail({ from: cfg.from, to: m.to, subject: m.subject, html: m.html, text: m.text, replyTo: cfg.replyTo || undefined });
      ids.push(info.messageId ?? null);
    }
    return { ok: true, ids };
  } catch (error) {
    return { ok: false, ids, error: error instanceof Error ? error.message : String(error) };
  } finally {
    transport.close();
  }
}

async function deliver(messages: Message[]): Promise<Delivery> {
  const cfg = await emailConfig();
  if (cfg.driver === "smtp") return deliverSmtp(cfg, messages);
  const from = cfg.from;
  const replyTo = cfg.replyTo || undefined;
  const payload = messages.map((m) => ({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, reply_to: replyTo }));
  const single = payload.length === 1;
  try {
    const response = await fetch(single ? "https://api.resend.com/emails" : "https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(single ? payload[0] : payload),
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; data?: { id: string }[]; message?: string };
    if (!response.ok) return { ok: false, ids: [], error: data.message ?? `Resend responded ${response.status}` };
    return { ok: true, ids: single ? [data.id ?? null] : (data.data ?? []).map((d) => d.id) };
  } catch (error) {
    return { ok: false, ids: [], error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sends templated emails through the driver chosen in Settings > Email (Resend batches 100 per request; SMTP
 * sends one by one). Never throws: email is best effort and every attempt is written to the email log.
 * With the "log" driver, or no credentials, messages are only logged, which is handy in development.
 */
export async function sendEmails(emails: OutgoingEmail[]): Promise<void> {
  if (!emails.length) return;
  const db = await getDb();
  const templates = new Map<TemplateKey, Awaited<ReturnType<typeof getTemplate>>>();
  type Rendered = OutgoingEmail & { subject: string; html: string; text: string };
  const rendered: Rendered[] = [];
  const skipped: Rendered[] = [];
  for (const email of emails) {
    if (!templates.has(email.template)) templates.set(email.template, await getTemplate(email.template));
    const template = templates.get(email.template)!;
    const message = { ...email, ...(await renderEmail(template, email.vars)) };
    (template.enabled ? rendered : skipped).push(message);
  }
  // Switched-off templates are recorded, not sent, so admins can see what was suppressed.
  if (skipped.length) {
    await db.insert(emailLog).values(skipped.map((m) => ({ to: m.to, template: m.template, subject: m.subject, html: m.html, status: "skipped" as const, error: "Template switched off in Settings" })));
  }
  const configured = await emailConfigured();

  for (let i = 0; i < rendered.length; i += 100) {
    const chunk = rendered.slice(i, i + 100);
    let status: "sent" | "failed" | "logged" = "logged";
    let result: Awaited<ReturnType<typeof deliver>> | null = null;
    if (configured) {
      result = await deliver(chunk);
      status = result.ok ? "sent" : "failed";
      if (!result.ok) console.error("Email delivery failed:", result.error);
    } else if (process.env.NODE_ENV !== "production") {
      for (const m of chunk) console.info(`[email:${m.template}] to ${m.to}: ${m.subject}`);
    }
    await db.insert(emailLog).values(
      chunk.map((m, j) => ({ to: m.to, template: m.template, subject: m.subject, html: m.html, status, error: result?.error ?? null, providerId: result?.ids[j] ?? null })),
    );
  }
}

export async function sendEmail(to: string, template: TemplateKey, vars: Vars): Promise<void> {
  await sendEmails([{ to, template, vars }]);
}

export { COMMON_VARIABLES };
