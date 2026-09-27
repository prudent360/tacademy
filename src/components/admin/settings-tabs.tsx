import Link from "next/link";
import { desc } from "drizzle-orm";
import { runRemindersNow, saveBranding, saveEmailSettings, saveGeneral, savePayments, saveReminders, sendTestEmailNow } from "@/app/actions/settings";
import { setTemplateEnabled } from "@/app/actions/admin";
import { CopyField } from "@/components/copy-field";
import { ActionButton, ActionForm, FileField, Input, SecretInput, Select, SubmitButton, Switch, Textarea } from "@/components/forms";
import { AlertIcon, BankIcon, CheckCircleIcon, ClockIcon, EditIcon, EyeIcon, MailIcon } from "@/components/icons";
import { Badge, DataTable, Notice, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { emailLog, emailTemplates, type Settings } from "@/db/schema";
import { bankTransferConfig, emailConfig, gatewayConfig, reminderConfig, type ResolvedGateway } from "@/lib/config";
import { REQUIRED_TEMPLATES } from "@/lib/email";
import { COMMON_VARIABLES, EMAIL_TEMPLATES, type TemplateKey } from "@/lib/email-templates";
import { CURRENCIES } from "@/lib/money";
import { testPaymentsAllowed } from "@/lib/payments";
import { maskSecret } from "@/lib/secrets";
import { absoluteUrl } from "@/lib/site";
import { relativeTime } from "@/lib/time";

function Section({ title, description, icon, badge, children, footer }: { title: string; description?: React.ReactNode; icon?: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-edge bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 md:px-6">
        <div className="flex items-start gap-3">
          {icon}
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-[17px] font-bold text-ink">{title}</h2>
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
        </div>
        {badge}
      </div>
      <div className="flex flex-col gap-5 p-5 md:p-6">{children}</div>
      {footer && <div className="border-t border-line px-5 py-3 text-xs text-muted md:px-6">{footer}</div>}
    </section>
  );
}

const Logo = ({ text, color }: { text: string; color: string }) => (
  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-extrabold text-white" style={{ background: color }}>{text}</span>
);

function gatewayBadge(cfg: ResolvedGateway, compact = false) {
  if (!cfg.enabled) return <Badge>Switched off</Badge>;
  if (!cfg.secretKey) return testPaymentsAllowed() ? <Badge tone="amber"><AlertIcon className="size-3.5" /> {compact ? "No keys" : "No keys: local test checkout"}</Badge> : <Badge tone="red"><AlertIcon className="size-3.5" /> Not configured</Badge>;
  return cfg.mode === "live" ? <Badge tone="green"><CheckCircleIcon className="size-3.5" /> Live</Badge> : <Badge tone="cyan"><CheckCircleIcon className="size-3.5" /> Test mode</Badge>;
}

function ModePicker({ name, value }: { name: string; value: "test" | "live" }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold text-ink">Mode</legend>
      <div className="inline-flex w-fit rounded-lg border border-edge-strong bg-panel p-1">
        {(["test", "live"] as const).map((m) => (
          <label key={m} className="cursor-pointer rounded-md px-4 py-1.5 text-sm font-semibold text-muted has-[:checked]:bg-white has-[:checked]:text-accent has-[:checked]:shadow-sm">
            <input type="radio" name={name} value={m} defaultChecked={value === m} className="sr-only" />
            {m === "test" ? "Test" : "Live"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------- General ----------

export function GeneralTab({ s }: { s: Settings }) {
  return (
    <ActionForm action={saveGeneral} className="flex flex-col gap-6">
      <Section title="Academy details" description="Shown across the website, emails and receipts.">
        <div className="grid gap-5 md:grid-cols-2">
          <Input label="Academy name" name="siteName" defaultValue={s.siteName} required />
          <Input label="Tagline" name="tagline" defaultValue={s.tagline} hint="Used in the footer and search results." />
        </div>
      </Section>
      <Section title="Contact" description="How students reach you. The support email is also the reply-to address for emails.">
        <div className="grid gap-5 md:grid-cols-3">
          <Input label="Support email" name="supportEmail" type="email" defaultValue={s.supportEmail} />
          <Input label="Phone" name="phone" defaultValue={s.phone} />
          <Input label="Address" name="address" defaultValue={s.address} />
        </div>
      </Section>
      <Section title="Time and currency">
        <Input label="Timezone" name="timezone" defaultValue={s.timezone} required hint="Class times are entered and shown in this timezone, e.g. Europe/London or Africa/Lagos." className="max-w-[420px]" />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink">Currencies you accept</legend>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <label key={c.code} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-edge-strong px-3.5 text-sm font-semibold has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
                <input type="checkbox" name="currencies" value={c.code} defaultChecked={s.currencies.includes(c.code)} className="size-4 accent-accent" />
                {c.code} <span className="font-normal text-muted">{c.gateway === "stripe" ? "Stripe" : "Paystack"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Select label="Main currency" name="primaryCurrency" defaultValue={s.currencies[0]} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code}: ${c.name}` }))} hint="Shown first on course pages and used for dashboard revenue." className="max-w-[420px]" />
      </Section>
      <div><SubmitButton>Save general settings</SubmitButton></div>
    </ActionForm>
  );
}

// ---------- Branding ----------

export function BrandingTab({ s }: { s: Settings }) {
  return (
    <ActionForm action={saveBranding} className="flex flex-col gap-6">
      <Section title="Logo" description="Replaces the drawn Tekskillup mark in the header, sidebar and footer.">
        <FileField label="Logo image" name="logo" current={s.logoUrl} removeName="removeLogo" hint="PNG or WebP with a transparent background, about 360×72 px." />
      </Section>
      <Section title="Home page hero">
        <Input label="Eyebrow" name="heroEyebrow" defaultValue={s.heroEyebrow} placeholder="Online & in-person cohorts" />
        <Input label="Headline" name="heroTitle" defaultValue={s.heroTitle} />
        <Textarea label="Introduction" name="heroSubtitle" defaultValue={s.heroSubtitle} rows={3} />
        <Textarea label="Stats" name="stats" defaultValue={s.stats.map((x) => `${x.value} | ${x.label}`).join("\n")} rows={4} hint="Up to 4 lines of: value | label, e.g. 1,200+ | Students trained" />
      </Section>
      <Section title="Social proof and FAQs">
        <Textarea label="Testimonials" name="testimonials" defaultValue={s.testimonials.map((t) => `${t.quote} | ${t.name} | ${t.role}`).join("\n")} rows={5} hint="One per line: quote | name | role" />
        <Textarea label="FAQs" name="faqs" defaultValue={s.faqs.map((f) => `${f.question}\n${f.answer}`).join("\n\n")} rows={10} hint="Question on the first line, answer on the next; leave a blank line between FAQs." />
      </Section>
      <div><SubmitButton>Save branding</SubmitButton></div>
    </ActionForm>
  );
}

// ---------- Payments ----------

export async function PaymentsTab({ s }: { s: Settings }) {
  const [stripe, paystack, bank] = await Promise.all([gatewayConfig("stripe"), gatewayConfig("paystack"), bankTransferConfig()]);
  const saved = s.payment;
  const envNote = (cfg: ResolvedGateway, envName: string) => cfg.source === "environment" ? <Notice tone="accent">Currently using the <code className="font-mono">{envName}</code> environment variable. Keys saved here take priority.</Notice> : null;

  return (
    <ActionForm action={savePayments} className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { name: "Stripe", logo: <Logo text="S" color="#635BFF" />, badge: gatewayBadge(stripe, true), text: "GBP · USD · EUR · CAD" },
          { name: "Paystack", logo: <Logo text="P" color="#0BA4DB" />, badge: gatewayBadge(paystack, true), text: "NGN · GHS · KES · ZAR" },
          { name: "Bank transfer", logo: <span className="flex size-10 items-center justify-center rounded-xl bg-navy text-white"><BankIcon className="size-5" /></span>, badge: bank.enabled ? <Badge tone="green"><CheckCircleIcon className="size-3.5" /> On</Badge> : <Badge>Off</Badge>, text: bank.enabled ? `${bank.currency}, confirmed by admins` : "Manual confirmation" },
        ].map((g) => (
          <div key={g.name} className="flex items-center gap-3 rounded-[14px] border border-edge bg-white p-4">
            {g.logo}
            <div className="flex min-w-0 flex-col gap-1"><span className="font-semibold text-ink">{g.name}</span><span className="whitespace-nowrap text-xs text-muted">{g.text}</span></div>
            <span className="ml-auto">{g.badge}</span>
          </div>
        ))}
      </div>

      <Section title="Stripe" description="Cards, Apple Pay and Google Pay for GBP, USD, EUR and CAD." icon={<Logo text="S" color="#635BFF" />} badge={gatewayBadge(stripe)}
        footer={<>Find your keys in the <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">Stripe Dashboard → Developers → API keys</a>. Create the webhook under Developers → Webhooks with the events <code className="font-mono">checkout.session.completed</code> and <code className="font-mono">checkout.session.async_payment_succeeded</code>.</>}>
        <Switch label="Accept payments with Stripe" name="stripeEnabled" defaultChecked={stripe.enabled} hint="When off, Stripe currencies aren't offered at checkout." />
        {envNote(stripe, "STRIPE_SECRET_KEY")}
        <ModePicker name="stripeMode" value={stripe.mode} />
        {stripe.mode === "live" && <Notice tone="amber"><strong>Live mode:</strong> real cards will be charged.</Notice>}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-xl border border-edge p-4">
            <p className="text-xs font-semibold uppercase tracking-[1px] text-muted">Test keys</p>
            <Input label="Publishable key" name="stripeTestPublicKey" defaultValue={saved.stripe?.testPublicKey} placeholder="pk_test_…" className="[&_input]:font-mono [&_input]:text-sm" />
            <SecretInput label="Secret key" name="stripeTestSecretKey" masked={maskSecret(saved.stripe?.testSecretKey)} placeholder="sk_test_…" />
            <SecretInput label="Webhook signing secret" name="stripeTestWebhookSecret" masked={maskSecret(saved.stripe?.testWebhookSecret)} placeholder="whsec_…" />
          </div>
          <div className="flex flex-col gap-4 rounded-xl border border-edge p-4">
            <p className="text-xs font-semibold uppercase tracking-[1px] text-muted">Live keys</p>
            <Input label="Publishable key" name="stripeLivePublicKey" defaultValue={saved.stripe?.livePublicKey} placeholder="pk_live_…" className="[&_input]:font-mono [&_input]:text-sm" />
            <SecretInput label="Secret key" name="stripeLiveSecretKey" masked={maskSecret(saved.stripe?.liveSecretKey)} placeholder="sk_live_…" />
            <SecretInput label="Webhook signing secret" name="stripeLiveWebhookSecret" masked={maskSecret(saved.stripe?.liveWebhookSecret)} placeholder="whsec_…" />
          </div>
        </div>
        <CopyField label="Webhook endpoint" value={absoluteUrl("/api/webhooks/stripe")} />
      </Section>

      <Section title="Paystack" description="Card, bank transfer and USSD for NGN, GHS, KES and ZAR." icon={<Logo text="P" color="#0BA4DB" />} badge={gatewayBadge(paystack)}
        footer={<>Find your keys in the <a href="https://dashboard.paystack.com/#/settings/developers" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">Paystack Dashboard → Settings → API Keys & Webhooks</a>, and paste the webhook URL there.</>}>
        <Switch label="Accept payments with Paystack" name="paystackEnabled" defaultChecked={paystack.enabled} hint="When off, Paystack currencies aren't offered at checkout." />
        {envNote(paystack, "PAYSTACK_SECRET_KEY")}
        <ModePicker name="paystackMode" value={paystack.mode} />
        {paystack.mode === "live" && <Notice tone="amber"><strong>Live mode:</strong> real payments will be taken.</Notice>}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-xl border border-edge p-4">
            <p className="text-xs font-semibold uppercase tracking-[1px] text-muted">Test keys</p>
            <Input label="Public key" name="paystackTestPublicKey" defaultValue={saved.paystack?.testPublicKey} placeholder="pk_test_…" className="[&_input]:font-mono [&_input]:text-sm" />
            <SecretInput label="Secret key" name="paystackTestSecretKey" masked={maskSecret(saved.paystack?.testSecretKey)} placeholder="sk_test_…" />
          </div>
          <div className="flex flex-col gap-4 rounded-xl border border-edge p-4">
            <p className="text-xs font-semibold uppercase tracking-[1px] text-muted">Live keys</p>
            <Input label="Public key" name="paystackLivePublicKey" defaultValue={saved.paystack?.livePublicKey} placeholder="pk_live_…" className="[&_input]:font-mono [&_input]:text-sm" />
            <SecretInput label="Secret key" name="paystackLiveSecretKey" masked={maskSecret(saved.paystack?.liveSecretKey)} placeholder="sk_live_…" />
          </div>
        </div>
        <CopyField label="Webhook URL" value={absoluteUrl("/api/webhooks/paystack")} />
      </Section>

      <Section title="Bank transfer" description="Students get your account details and a payment reference; you confirm under Payments when the money arrives." icon={<span className="flex size-10 items-center justify-center rounded-xl bg-navy text-white"><BankIcon className="size-5" /></span>}>
        <Switch label="Offer bank transfer at checkout" name="bankEnabled" defaultChecked={bank.enabled} hint="Shown as “Pay by bank transfer” under the card payment button." />
        <div className="grid gap-5 md:grid-cols-2">
          <Input label="Account name" name="bankAccountName" defaultValue={bank.accountName} />
          <Input label="Bank" name="bankName" defaultValue={bank.bankName} />
          <Input label="Account number" name="bankAccountNumber" defaultValue={bank.accountNumber} />
          <Input label="Sort code / routing (optional)" name="bankSortCode" defaultValue={bank.sortCode} />
        </div>
        <Select label="Currency" name="bankCurrency" defaultValue={bank.currency} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code}: ${c.name}` }))} hint="The cohort's price in this currency is used." className="max-w-[360px]" />
        <Textarea label="Instructions" name="bankInstructions" defaultValue={bank.instructions} rows={3} placeholder="Use your payment reference as the transfer description. Places are confirmed within one working day." />
      </Section>

      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-4 rounded-[14px] border border-edge bg-white/95 px-5 py-3 shadow-lg backdrop-blur lg:bottom-4">
        <p className="text-sm text-muted">Secret keys are encrypted before they&apos;re stored and are never shown again in full.</p>
        <SubmitButton>Save payment settings</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ---------- Email ----------

export async function EmailTab({ s }: { s: Settings }) {
  const [cfg, log] = await Promise.all([emailConfig(), (await getDb()).select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(15)]);
  return (
    <div className="flex flex-col gap-6">
      <ActionForm action={saveEmailSettings} className="flex flex-col gap-6">
        <Section title="Email delivery" description="Automatic emails (receipts, reminders, feedback) are sent through Resend." icon={<span className="flex size-10 items-center justify-center rounded-xl bg-ink text-white"><MailIcon className="size-5" /></span>}
          badge={cfg.apiKey ? <Badge tone="green"><CheckCircleIcon className="size-3.5" /> Delivering</Badge> : <Badge tone="amber"><AlertIcon className="size-3.5" /> Logging only</Badge>}
          footer={<>Create an API key at <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">resend.com/api-keys</a> and verify your domain under Domains so emails come from your own address.</>}>
          {!cfg.apiKey && <Notice tone="amber">No API key yet, so emails are written to the log below instead of being delivered.</Notice>}
          {cfg.source === "environment" && <Notice tone="accent">Currently using the <code className="font-mono">RESEND_API_KEY</code> environment variable. A key saved here takes priority.</Notice>}
          <SecretInput label="Resend API key" name="apiKey" masked={maskSecret(s.email.apiKey)} placeholder="re_…" />
          <div className="grid gap-5 md:grid-cols-3">
            <Input label="Sender name" name="fromName" defaultValue={s.email.fromName} placeholder={s.siteName} />
            <Input label="Sender address" name="fromAddress" type="email" defaultValue={s.email.fromAddress} placeholder="hello@yourdomain.com" hint="Must be on a domain verified in Resend." />
            <Input label="Reply-to" name="replyTo" type="email" defaultValue={s.email.replyTo} placeholder={s.supportEmail || "support@yourdomain.com"} />
          </div>
          <p className="text-sm text-muted">Emails currently go out as <span className="font-semibold text-ink">{cfg.from}</span>.</p>
        </Section>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>Save email settings</SubmitButton>
          <ActionButton action={sendTestEmailNow} pendingText="Sending…" doneText="Sent. Check your inbox or the log">Send a test email to me</ActionButton>
        </div>
      </ActionForm>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[17px] font-bold text-ink">Recent emails</h2>
        <DataTable>
          <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Template</th><th>Status</th></tr></thead>
          <tbody>
            {log.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap text-muted">{relativeTime(e.createdAt)}</td>
                <td className="text-body">{e.to}</td>
                <td><Link href={`/admin/emails/log/${e.id}`} className="font-semibold text-ink hover:text-accent">{e.subject}</Link></td>
                <td className="text-muted">{EMAIL_TEMPLATES[e.template as TemplateKey]?.name ?? e.template}</td>
                <td><StatusBadge status={e.status} label={e.status === "logged" ? "Logged only" : e.status === "skipped" ? "Switched off" : undefined} />{e.error && e.status === "failed" && <p className="mt-1 max-w-[260px] text-xs text-red-700">{e.error}</p>}</td>
              </tr>
            ))}
            {!log.length && <tr><td colSpan={5} className="py-10 text-center text-muted">No emails yet.</td></tr>}
          </tbody>
        </DataTable>
      </section>
    </div>
  );
}

// ---------- Templates ----------

export async function TemplatesTab() {
  const rows = await (await getDb()).select().from(emailTemplates);
  return (
    <div className="flex flex-col gap-4">
      <Notice tone="accent">Edit the wording of each automatic email. Insert values with placeholders like <code className="font-mono">{"{{name}}"}</code>; the branded layout, buttons and footer are added for you. Account-security emails can&apos;t be switched off.</Notice>
      <ul className="flex flex-col gap-3">
        {(Object.entries(EMAIL_TEMPLATES) as [TemplateKey, (typeof EMAIL_TEMPLATES)[TemplateKey]][]).map(([key, def]) => {
          const row = rows.find((r) => r.key === key);
          const required = REQUIRED_TEMPLATES.includes(key);
          const enabled = required || (row?.enabled ?? true);
          const customised = Boolean(row && (row.subject !== def.subject || row.body !== def.body));
          const vars = Object.keys({ ...COMMON_VARIABLES, ...def.variables });
          return (
            <li key={key} className={`rounded-[14px] border bg-white p-5 transition-colors ${enabled ? "border-edge hover:border-accent-muted" : "border-dashed border-edge-strong bg-panel"}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-[16px] font-bold text-ink">{def.name}</h3>
                    {required ? <Badge tone="navy">Required</Badge> : enabled ? <Badge tone="green">Active</Badge> : <Badge>Off</Badge>}
                    {customised && <Badge tone="accent">Customised</Badge>}
                  </div>
                  <p className="text-sm text-muted">{def.description}</p>
                  <p className="text-xs text-muted">Subject: <span className="font-medium text-body">{row?.subject ?? def.subject}</span></p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {vars.map((v) => <code key={v} className="rounded bg-page px-1.5 py-0.5 text-[11px] text-muted">{`{{${v}}}`}</code>)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link href={`/admin/emails/${key}#preview`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-edge-strong bg-white px-3.5 text-sm font-semibold text-ink hover:bg-page"><EyeIcon className="size-4" /> Preview</Link>
                  <Link href={`/admin/emails/${key}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent-dark"><EditIcon className="size-4" /> Edit</Link>
                  {!required && (enabled
                    ? <ActionButton action={setTemplateEnabled.bind(null, key, false)} variant="danger" pendingText="…">Turn off</ActionButton>
                    : <ActionButton action={setTemplateEnabled.bind(null, key, true)} pendingText="…">Turn on</ActionButton>)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Reminders ----------

async function runNow() {
  "use server";
  return runRemindersNow();
}

export async function RemindersTab() {
  const r = await reminderConfig();
  const cron = Boolean(process.env.CRON_SECRET);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
      <ActionForm action={saveReminders} className="flex flex-col gap-6">
        <Section title="Class reminders" description="Sent by email and in-app to every active student in the cohort." icon={<span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><ClockIcon className="size-5" /></span>}>
          <Switch label="The day before" name="dayBefore" defaultChecked={r.dayBefore} hint="Sent within 24 hours of each class." />
          <Switch label="Shortly before class starts" name="hourBefore" defaultChecked={r.hourBefore} hint="Includes the joining link or venue." />
          <Input label="Minutes before class" name="hourLeadMinutes" type="number" min={15} max={360} step={5} defaultValue={r.hourLeadMinutes} className="max-w-[240px]" />
        </Section>
        <Section title="Assignment deadlines" description="Only students who haven't submitted are reminded.">
          <Switch label="Remind before the deadline" name="assignmentDue" defaultChecked={r.assignmentDue} />
          <Input label="Hours before the deadline" name="assignmentLeadHours" type="number" min={1} max={168} defaultValue={r.assignmentLeadHours} className="max-w-[240px]" />
        </Section>
        <p className="text-sm text-muted">Students can turn reminder emails off in their account; in-app notifications are always created. The wording is in the <Link href="/admin/settings?tab=templates" className="font-semibold text-accent">Class reminder</Link> and <Link href="/admin/settings?tab=templates" className="font-semibold text-accent">Assignment due soon</Link> templates.</p>
        <div><SubmitButton>Save reminder settings</SubmitButton></div>
      </ActionForm>
      <Section title="Scheduler" badge={cron ? <Badge tone="green"><CheckCircleIcon className="size-3.5" /> Protected</Badge> : <Badge tone="amber"><AlertIcon className="size-3.5" /> CRON_SECRET missing</Badge>}>
        <p className="text-sm leading-relaxed text-body">Reminders are sent when the scheduler calls the reminder endpoint. Vercel Cron calls it daily, and the included GitHub Actions workflow calls it every 15 minutes so the pre-class reminder arrives on time.</p>
        <CopyField label="Endpoint" value={absoluteUrl("/api/cron/reminders")} />
        <p className="text-xs text-muted">Requests must send <code className="font-mono">Authorization: Bearer $CRON_SECRET</code>. Add <code className="font-mono">SITE_URL</code> and <code className="font-mono">CRON_SECRET</code> as GitHub repository secrets to enable the workflow.</p>
        <ActionForm action={runNow} className="flex flex-col gap-3 border-t border-line pt-5">
          <p className="text-sm text-muted">Send anything that&apos;s due right now. Reminders are never sent twice.</p>
          <SubmitButton pendingText="Checking…">Run reminders now</SubmitButton>
        </ActionForm>
      </Section>
    </div>
  );
}
