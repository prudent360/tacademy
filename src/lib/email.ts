import "server-only";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { marked } from "marked";
import nodemailer from "nodemailer";
import { getDb } from "@/db";
import { emailLog, emailTemplates } from "@/db/schema";
import { emailConfig, type ResolvedEmail } from "./config";
import { getSettings } from "./data";
import { COMMON_VARIABLES, EMAIL_TEMPLATES, type TemplateKey } from "./email-templates";
import { companyInfo, companyStatement } from "./company";
import { absoluteUrl, siteUrl } from "./site";
import { fromZonedInput, toZonedInput } from "./time";

export type Vars = Record<string, string | number | null | undefined>;
export type OutgoingEmail = { to: string; template: TemplateKey; vars: Vars };

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export async function emailConfigured(): Promise<boolean> {
  return (await emailConfig()).ready;
}

/** Account-security emails can't be switched off. */
export const REQUIRED_TEMPLATES: TemplateKey[] = ["password_reset", "verify_email", "invite", "welcome", "account_setup", "email_code", "student_account"];

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
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:#4f3fd7"><a href="${url}" style="display:inline-block;padding:13px 24px;font-weight:600;font-size:15px;color:#ffffff;text-decoration:none;border-radius:8px">${label}</a></td></tr></table>`;
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
  const wordmark = `<span style="color:#ffffff">${escapeHtml(first)}</span>${rest.length ? `<span style="color:#bcb5f7;font-weight:600;letter-spacing:-0.3px"> ${escapeHtml(rest.join(" "))}</span>` : ""}`;
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
  // A "# heading" line shows as a large, spaced-out code box (used for sign-up codes).
  const content = (await marked.parse(withButtons, { gfm: true, breaks: true })).replace(/<h1>/g, '<h1 style="margin:8px 0 24px;display:inline-block;padding:14px 22px;border-radius:5px;background:#f1effd;color:#181340;font-size:32px;font-weight:700;letter-spacing:8px;font-family:Menlo,Consolas,monospace">');
  const text = fill(source.body, all, false).replace(/^\s*\[\[([^|\]]+)\|([^\]]+)\]\]\s*$/gm, "$1: $2").replace(/\*\*/g, "");

  const brand = escapeHtml(settings.siteName);
  // UK companies must show their registered details on business emails.
  const company = companyStatement(companyInfo(settings), settings.siteName);
  const home = siteUrl();
  const contact = [
    settings.address && `<tr><td style="padding:0 0 6px;font-size:13px;line-height:1.55;color:#c9c6e4"><span style="color:#8884ab">Address</span>&nbsp; ${escapeHtml(settings.address)}</td></tr>`,
    settings.supportEmail && `<tr><td style="padding:0 0 6px;font-size:13px;line-height:1.55;color:#c9c6e4"><span style="color:#8884ab">Email</span>&nbsp; <a href="mailto:${escapeHtml(settings.supportEmail)}" style="color:#ffffff;text-decoration:none">${escapeHtml(settings.supportEmail)}</a></td></tr>`,
    settings.phone && `<tr><td style="padding:0 0 6px;font-size:13px;line-height:1.55;color:#c9c6e4"><span style="color:#8884ab">Phone</span>&nbsp; ${escapeHtml(settings.phone)}</td></tr>`,
  ].filter(Boolean).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<style>.email-body p{margin:0 0 16px}.email-body table.content td{padding:6px 12px 6px 0}.email-body a{color:#4f3fd7}
@media (max-width:520px){.email-pad{padding-left:24px!important;padding-right:24px!important}.email-tagline{display:none!important}.email-stack{display:block!important;width:100%!important;text-align:left!important;padding:0 0 18px!important}}</style></head>
<body style="margin:0;padding:0;background:#ecebf1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#181340">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecebf1;padding:28px 0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff">
<tr><td align="center" class="email-pad" style="background:#161238;padding:40px 40px 36px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle">${emailLogo(settings, home, "large")}</td>
<td class="email-tagline" style="vertical-align:middle;padding-left:22px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-left:1px solid #423d6b;padding-left:22px;font-size:14px;line-height:1.45;font-weight:600;color:#e1def8">Practical tech training,<br>live online &amp; in person.</td></tr></table></td>
</tr></table></td></tr>
<tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:#4f3fd7;background-image:linear-gradient(90deg,#4f3fd7 0%,#4f3fd7 65%,#31c4f0 100%)">&nbsp;</td></tr>
<tr><td class="email-body email-pad" style="padding:40px 48px 32px;font-size:16px;line-height:1.65;color:#2a2741">
${content.replace(/<table>/g, '<table class="content" style="border-collapse:collapse;margin:0 0 16px">')}
</td></tr>
<tr><td class="email-pad" style="background:#f0effc;padding:22px 48px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td class="email-stack" style="vertical-align:middle;font-size:15px;line-height:1.5;color:#2a2741"><strong style="color:#181340">Keep learning with us</strong><br><span style="font-size:14px;color:#59576d">See upcoming cohorts and new courses.</span></td>
<td class="email-stack" align="right" style="vertical-align:middle;white-space:nowrap"><a href="${absoluteUrl("/courses")}" style="display:inline-block;background:#ffffff;border:1px solid #d1cdf6;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:600;color:#4f3fd7;text-decoration:none">Browse courses &rsaquo;</a></td>
</tr></table></td></tr>
<tr><td class="email-pad" style="background:#161238;padding:32px 48px 28px">
${settings.tagline ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#c9c6e4">${escapeHtml(settings.tagline)}</p>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td class="email-stack" style="vertical-align:top"><table role="presentation" cellpadding="0" cellspacing="0">${contact}</table></td>
<td class="email-stack" align="right" style="vertical-align:top">${emailLogo(settings, home, "small")}</td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #2f2a55"><tr><td style="padding-top:16px;font-size:12px;line-height:1.6;color:#8884ab">© ${new Date().getFullYear()} ${brand}&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${home}" style="color:#bcb5f7;text-decoration:none">Website</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${absoluteUrl("/account")}" style="color:#bcb5f7;text-decoration:none">Manage email preferences</a></td></tr>${company ? `<tr><td style="padding-top:8px;font-size:11px;line-height:1.6;color:#6f6b94">${escapeHtml(company)}</td></tr>` : ""}</table>
</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

type Message = { to: string; subject: string; html: string; text: string };
/** One result per message, in order. `deferred`: the provider's sending limit was hit, so try again later. */
type Result = { status: "sent" | "failed" | "deferred"; id: string | null; error?: string };

/** Provider replies that mean "you've sent too much", as opposed to a bad address or broken settings. */
const LIMIT_ERROR = /limit|quota|exceed|too many|\brate\b|throttl|try again later|\b(421|450|451|452|454)\b|5\.4\.6|4\.7\.0/i;

/** Sends one at a time over a single SMTP connection, recording each message's own result. */
async function deliverSmtp(cfg: ResolvedEmail, messages: Message[]): Promise<Result[]> {
  const { host, port, security, user, password } = cfg.smtp;
  const transport = nodemailer.createTransport({ host, port, secure: security === "ssl", requireTLS: security === "tls", auth: { user, pass: password }, connectionTimeout: 15_000 });
  const results: Result[] = [];
  try {
    for (const m of messages) {
      try {
        const info = await transport.sendMail({ from: cfg.from, to: m.to, subject: m.subject, html: m.html, text: m.text, replyTo: cfg.replyTo || undefined });
        results.push({ status: "sent", id: info.messageId ?? null });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (LIMIT_ERROR.test(message)) {
          // The mailbox has hit its limit: everything left waits for later.
          while (results.length < messages.length) results.push({ status: "deferred", id: null, error: message });
          break;
        }
        results.push({ status: "failed", id: null, error: message });
        // Can't connect or sign in: the rest would fail the same way.
        if (/auth|connect|ECONN|ETIMEDOUT|EAUTH|ESOCKET|certificate/i.test(message)) {
          while (results.length < messages.length) results.push({ status: "failed", id: null, error: message });
          break;
        }
      }
    }
  } finally {
    transport.close();
  }
  return results;
}

async function deliver(messages: Message[]): Promise<Result[]> {
  const cfg = await emailConfig();
  if (cfg.driver === "smtp") return deliverSmtp(cfg, messages);
  const from = cfg.from;
  const replyTo = cfg.replyTo || undefined;
  const payload = messages.map((m) => ({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, reply_to: replyTo }));
  const single = payload.length === 1;
  const all = (status: Result["status"], error: string): Result[] => messages.map(() => ({ status, id: null, error }));
  try {
    const response = await fetch(single ? "https://api.resend.com/emails" : "https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(single ? payload[0] : payload),
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; data?: { id: string }[]; message?: string };
    if (!response.ok) {
      const error = data.message ?? `Resend responded ${response.status}`;
      return all(response.status === 429 || LIMIT_ERROR.test(error) ? "deferred" : "failed", error);
    }
    const ids = single ? [data.id ?? null] : (data.data ?? []).map((d) => d.id);
    return messages.map((_, i) => ({ status: "sent", id: ids[i] ?? null }));
  } catch (error) {
    return all("failed", error instanceof Error ? error.message : String(error));
  }
}

/** Sign-in codes and password links are needed now, so they skip the queue. */
const URGENT: TemplateKey[] = ["email_code", "password_reset", "verify_email"];

/** Emails sent since midnight (academy time), and how many more are allowed today. Infinity means no limit. */
export async function sendingAllowance(): Promise<{ limit: number; sentToday: number; remaining: number }> {
  const settings = await getSettings();
  const limit = Math.max(0, Math.floor(Number(settings.email?.dailyLimit) || 0));
  const midnight = fromZonedInput(`${toZonedInput(new Date(), settings.timezone).slice(0, 10)}T00:00`, settings.timezone);
  const [{ n }] = await (await getDb()).select({ n: count() }).from(emailLog).where(and(eq(emailLog.status, "sent"), gte(emailLog.createdAt, midnight)));
  return { limit, sentToday: n, remaining: limit ? Math.max(0, limit - n) : Infinity };
}

export type SendSummary = { sent: number; queued: number; failed: number; logged: number; skipped: number };

/**
 * Sends templated emails through the driver chosen in Settings > Email (Resend batches 100 per request; SMTP
 * sends one by one). Never throws: email is best effort and every attempt is written to the email log.
 * With a daily limit set, emails over it are queued and sent when the limit resets (see flushEmailQueue).
 * With the "log" driver, or no credentials, messages are only logged, which is handy in development.
 */
export async function sendEmails(emails: OutgoingEmail[]): Promise<SendSummary> {
  const summary: SendSummary = { sent: 0, queued: 0, failed: 0, logged: 0, skipped: 0 };
  if (!emails.length) return summary;
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
    summary.skipped = skipped.length;
  }
  if (!rendered.length) return summary;
  const row = (m: Rendered, status: "sent" | "failed" | "logged" | "queued", error: string | null = null, providerId: string | null = null) =>
    ({ to: m.to, template: m.template, subject: m.subject, html: m.html, text: status === "queued" ? m.text : "", status, error, providerId });

  if (!(await emailConfigured())) {
    if (process.env.NODE_ENV !== "production") for (const m of rendered) console.info(`[email:${m.template}] to ${m.to}: ${m.subject}`);
    await db.insert(emailLog).values(rendered.map((m) => row(m, "logged")));
    summary.logged = rendered.length;
    return summary;
  }

  // Within today's allowance, in order; urgent emails always go now.
  let { remaining } = await sendingAllowance();
  const now: Rendered[] = [];
  const later: Rendered[] = [];
  for (const m of rendered) {
    if (URGENT.includes(m.template)) now.push(m);
    else if (remaining > 0) { now.push(m); remaining--; }
    else later.push(m);
  }
  const rows = later.map((m) => row(m, "queued", "Waiting for today's sending limit to reset"));
  for (let i = 0; i < now.length; i += 100) {
    const chunk = now.slice(i, i + 100);
    const results = await deliver(chunk);
    chunk.forEach((m, j) => {
      const r = results[j];
      // An urgent email is useless tomorrow, so it fails instead of waiting.
      const status = r.status === "deferred" ? (URGENT.includes(m.template) ? "failed" : "queued") : r.status;
      if (status === "failed") console.error(`Email to ${m.to} failed:`, r.error);
      rows.push(row(m, status, r.error ?? null, r.id));
    });
  }
  for (const r of rows) summary[r.status === "queued" ? "queued" : r.status === "sent" ? "sent" : "failed"]++;
  for (let i = 0; i < rows.length; i += 200) await db.insert(emailLog).values(rows.slice(i, i + 200));
  // Something went out, so there may be room for emails queued earlier.
  if (summary.sent && !summary.queued) await flushEmailQueue().catch((e) => console.error("Email queue:", e));
  return summary;
}

/** Sends queued emails, oldest first, as far as today's allowance goes. Run by the daily cron, after sends, and from Settings. */
export async function flushEmailQueue(max = 500): Promise<{ sent: number; failed: number; waiting: number }> {
  const db = await getDb();
  const result = { sent: 0, failed: 0, waiting: 0 };
  const countWaiting = async () => (await db.select({ n: count() }).from(emailLog).where(eq(emailLog.status, "queued")))[0].n;
  if (!(await emailConfigured())) return { ...result, waiting: await countWaiting() };
  const { remaining } = await sendingAllowance();
  const take = Math.min(max, remaining);
  if (take > 0) {
    const queued = await db.select().from(emailLog).where(eq(emailLog.status, "queued")).orderBy(asc(emailLog.id)).limit(take);
    for (let i = 0; i < queued.length; i += 100) {
      const chunk = queued.slice(i, i + 100);
      const results = await deliver(chunk.map((q) => ({ to: q.to, subject: q.subject, html: q.html, text: q.text })));
      let deferred = false;
      for (const [j, q] of chunk.entries()) {
        const r = results[j];
        if (r.status === "deferred") { deferred = true; continue; }
        await db.update(emailLog).set({ status: r.status, error: r.error ?? null, providerId: r.id, createdAt: new Date() }).where(eq(emailLog.id, q.id));
        result[r.status === "sent" ? "sent" : "failed"]++;
      }
      // The provider says stop for now.
      if (deferred) break;
    }
  }
  result.waiting = await countWaiting();
  return result;
}

export async function sendEmail(to: string, template: TemplateKey, vars: Vars): Promise<void> {
  await sendEmails([{ to, template, vars }]);
}

export { COMMON_VARIABLES };
