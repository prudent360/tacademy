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

/**
 * The logo for the dark email header and footer: the uploaded dark-background logo, else the light logo on a
 * white tile, else the white brand mark beside the wordmark (a PNG, since email clients don't show SVG).
 */
function emailLogo(settings: { siteName: string; logoUrl: string | null; logoDarkUrl: string | null }, home: string, size: "large" | "small"): string {
  const alt = escapeHtml(settings.siteName);
  const large = size === "large";
  if (settings.logoDarkUrl) {
    const height = large ? 44 : 30;
    return `<a href="${home}" style="text-decoration:none"><img src="${escapeHtml(absoluteUrl(settings.logoDarkUrl))}" alt="${alt}" height="${height}" style="display:block;height:${height}px;width:auto;max-width:220px;border:0"></a>`;
  }
  if (settings.logoUrl) {
    const height = large ? 40 : 28;
    return `<a href="${home}" style="display:inline-block;background:#ffffff;border-radius:10px;padding:${large ? "10px 16px" : "7px 12px"};text-decoration:none"><img src="${escapeHtml(absoluteUrl(settings.logoUrl))}" alt="${alt}" height="${height}" style="display:block;height:${height}px;width:auto;max-width:200px;border:0"></a>`;
  }
  const [first, ...rest] = settings.siteName.split(" ");
  const mark = large ? 40 : 28;
  const wordmark = `<span style="color:#ffffff">${escapeHtml(first)}</span>${rest.length ? `<span style="color:#c9b5f7;font-weight:600;letter-spacing:-0.3px"> ${escapeHtml(rest.join(" "))}</span>` : ""}`;
  return `<a href="${home}" style="text-decoration:none"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:${large ? 11 : 8}px;vertical-align:middle"><img src="${absoluteUrl("/email/logo-mark-reversed.png")}" alt="" width="${mark}" height="${mark}" style="display:block;width:${mark}px;height:${mark}px;border:0"></td>
<td style="vertical-align:middle;font-size:${large ? 25 : 18}px;font-weight:800;letter-spacing:-0.6px;line-height:1;white-space:nowrap">${wordmark}</td>
</tr></table></a>`;
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
  const home = siteUrl();
  const contact = [
    settings.address && `<tr><td style="padding:0 0 6px;font-size:13px;line-height:1.55;color:#cfc6e4"><span style="color:#8f84ab">Address</span>&nbsp; ${escapeHtml(settings.address)}</td></tr>`,
    settings.supportEmail && `<tr><td style="padding:0 0 6px;font-size:13px;line-height:1.55;color:#cfc6e4"><span style="color:#8f84ab">Email</span>&nbsp; <a href="mailto:${escapeHtml(settings.supportEmail)}" style="color:#ffffff;text-decoration:none">${escapeHtml(settings.supportEmail)}</a></td></tr>`,
    settings.phone && `<tr><td style="padding:0 0 6px;font-size:13px;line-height:1.55;color:#cfc6e4"><span style="color:#8f84ab">Phone</span>&nbsp; ${escapeHtml(settings.phone)}</td></tr>`,
  ].filter(Boolean).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<style>.email-body p{margin:0 0 16px}.email-body table.content td{padding:6px 12px 6px 0}.email-body a{color:#7134d9}
@media (max-width:520px){.email-pad{padding-left:24px!important;padding-right:24px!important}.email-tagline{display:none!important}.email-stack{display:block!important;width:100%!important;text-align:left!important;padding:0 0 18px!important}}</style></head>
<body style="margin:0;padding:0;background:#ecebf1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#19112e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecebf1;padding:28px 0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff">
<tr><td align="center" class="email-pad" style="background:#1d1238;padding:40px 40px 36px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle">${emailLogo(settings, home, "large")}</td>
<td class="email-tagline" style="vertical-align:middle;padding-left:22px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-left:1px solid #4a3d6b;padding-left:22px;font-size:14px;line-height:1.45;font-weight:600;color:#e6def8">Practical tech training,<br>live online &amp; in person.</td></tr></table></td>
</tr></table></td></tr>
<tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:#7134d9;background-image:linear-gradient(90deg,#7134d9 0%,#7134d9 65%,#31c4f0 100%)">&nbsp;</td></tr>
<tr><td class="email-body email-pad" style="padding:40px 48px 32px;font-size:16px;line-height:1.65;color:#2e2741">
${content.replace(/<table>/g, '<table class="content" style="border-collapse:collapse;margin:0 0 16px">')}
</td></tr>
<tr><td class="email-pad" style="background:#f3effc;padding:22px 48px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td class="email-stack" style="vertical-align:middle;font-size:15px;line-height:1.5;color:#2e2741"><strong style="color:#19112e">Keep learning with us</strong><br><span style="font-size:14px;color:#5e576d">See upcoming cohorts and new courses.</span></td>
<td class="email-stack" align="right" style="vertical-align:middle;white-space:nowrap"><a href="${absoluteUrl("/courses")}" style="display:inline-block;background:#ffffff;border:1px solid #d9cdf6;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:600;color:#7134d9;text-decoration:none">Browse courses &rsaquo;</a></td>
</tr></table></td></tr>
<tr><td class="email-pad" style="background:#1d1238;padding:32px 48px 28px">
${settings.tagline ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#cfc6e4">${escapeHtml(settings.tagline)}</p>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td class="email-stack" style="vertical-align:top"><table role="presentation" cellpadding="0" cellspacing="0">${contact}</table></td>
<td class="email-stack" align="right" style="vertical-align:top">${emailLogo(settings, home, "small")}</td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #362a55"><tr><td style="padding-top:16px;font-size:12px;line-height:1.6;color:#8f84ab">© ${new Date().getFullYear()} ${brand}&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${home}" style="color:#c9b5f7;text-decoration:none">Website</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${absoluteUrl("/account")}" style="color:#c9b5f7;text-decoration:none">Manage email preferences</a></td></tr></table>
</td></tr>
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
