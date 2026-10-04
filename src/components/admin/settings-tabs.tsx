import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { runRemindersNow, saveAiSettings, saveSeo, saveVideoSettings, saveBranding, saveEmailSettings, saveGeneral, savePayments, saveReferralSettings, saveReminders, sendQueuedEmailsNow, sendTestEmailNow, testAiConnection } from "@/app/actions/settings";
import { setTemplateEnabled } from "@/app/actions/admin";
import { CopyField } from "@/components/copy-field";
import { AiProviderFields } from "@/components/admin/ai-provider";
import { EmailDriverFields } from "@/components/admin/email-driver";
import { TransactpayCheckButton } from "@/components/admin/transactpay-check";
import { ActionButton, ActionForm, FileField, Input, SecretInput, Select, SubmitButton, Switch, Textarea } from "@/components/forms";
import { AlertIcon, BankIcon, CheckCircleIcon, ClockIcon, EditIcon, EyeIcon, MailIcon, SearchIcon, SparkIcon } from "@/components/icons";
import { Badge, DataTable, Notice, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { emailLog, emailTemplates, type Settings } from "@/db/schema";
import { bankTransferConfig, emailConfig, gatewayConfig, reminderConfig, type ResolvedGateway } from "@/lib/config";
import { AI_MODELS, aiConfig } from "@/lib/ai";
import { REQUIRED_TEMPLATES, sendingAllowance } from "@/lib/email";
import { COMMON_VARIABLES, EMAIL_TEMPLATES, type TemplateKey } from "@/lib/email-templates";
import { CURRENCIES } from "@/lib/money";
import { testPaymentsAllowed } from "@/lib/payments";
import { maskSecret } from "@/lib/secrets";
import { referralConfig } from "@/lib/referrals";
import { seoConfig } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { relativeTime } from "@/lib/time";

function Section({ title, description, icon, badge, children, footer }: { title: string; description?: React.ReactNode; icon?: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-edge bg-surface">
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
          <label key={m} className="cursor-pointer rounded-md px-4 py-1.5 text-sm font-semibold text-muted has-[:checked]:bg-surface has-[:checked]:text-accent-ink has-[:checked]:shadow-sm">
            <input type="radio" name={name} value={m} defaultChecked={value === m} className="sr-only" />
            {m === "test" ? "Test" : "Live"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------- General ----------

export async function GeneralTab({ s }: { s: Settings }) {
  const [stripe, paystack, transactpay, bank] = await Promise.all([gatewayConfig("stripe"), gatewayConfig("paystack"), gatewayConfig("transactpay"), bankTransferConfig()]);
  // Only gateways that are switched on and have keys, so the labels match what students can actually use.
  const ready = (cfg: ResolvedGateway) => cfg.enabled && Boolean(cfg.secretKey);
  const takenBy = (code: string) => [
    transactpay.enabled && transactpay.currencies?.includes(code) ? "TransactPay" : "",
    CURRENCIES.find((c) => c.code === code)?.gateway === "stripe" && ready(stripe) ? "Stripe" : "",
    CURRENCIES.find((c) => c.code === code)?.gateway === "paystack" && ready(paystack) ? "Paystack" : "",
    bank.enabled && bank.currency === code ? "Bank transfer" : "",
  ].filter(Boolean);
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
              <label key={c.code} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-edge-strong px-3.5 text-sm font-semibold has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink">
                <input type="checkbox" name="currencies" value={c.code} defaultChecked={s.currencies.includes(c.code)} className="size-4 accent-accent" />
                {c.code} {takenBy(c.code).length ? <span className="font-normal text-muted">{takenBy(c.code).join(" · ")}</span> : <span className="font-normal text-amber-700">No gateway on</span>}
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
      <Section title="Logo and icon" description="Replace the drawn Tekskillup mark. Leave any of these empty to keep the built-in version.">
        <div className="grid gap-6 md:grid-cols-2">
          <FileField label="Logo for light backgrounds (website and dashboard)" name="logo" current={s.logoUrl} removeName="removeLogo" previewClassName="h-12 w-auto max-w-[220px] rounded-md bg-white object-contain p-1.5 ring-1 ring-edge" hint="Dark text or colours. Used on the website, the sign-in page and the dashboard sidebar. PNG or WebP with a transparent background, about 360×72 px." />
          <FileField label="Logo for dark backgrounds (emails)" name="logoDark" current={s.logoDarkUrl} removeName="removeLogoDark" previewClassName="h-12 w-auto max-w-[220px] rounded-md bg-[#161238] object-contain p-1.5" hint="White or light text. Used in the dark header and footer of emails. Without it, the light logo is shown on a white tile." />
        </div>
        <FileField label="Favicon" name="favicon" current={s.faviconUrl} removeName="removeFavicon" previewClassName="size-12 rounded-md bg-white object-contain p-1 ring-1 ring-edge" hint="The small icon in browser tabs, bookmarks and phone home screens. A square PNG, at least 512×512 px." />
      </Section>
      <Section title="Home page hero">
        <Input label="Eyebrow" name="heroEyebrow" defaultValue={s.heroEyebrow} placeholder="Online & in-person cohorts" />
        <Input label="Headline" name="heroTitle" defaultValue={s.heroTitle} hint="Wrap words in *asterisks* to highlight them, e.g. Learn tech skills with *real instructors*." />
        <Textarea label="Introduction" name="heroSubtitle" defaultValue={s.heroSubtitle} rows={3} />
        <FileField label="Home hero photo" name="heroImage" current={s.heroImageUrl} removeName="removeHeroImage" hint="Shown on the right of the home page hero, blended into the background. A landscape or 4:3 photo with people towards the centre works best. Remove it to go back to the default team photo." />
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
  const [stripe, paystack, transactpay, bank] = await Promise.all([gatewayConfig("stripe"), gatewayConfig("paystack"), gatewayConfig("transactpay"), bankTransferConfig()]);
  // TransactPay needs three keys; until all are there, naira stays with Paystack.
  const transactpayBadge = (compact = false) => transactpay.enabled && transactpay.secretKey && (!transactpay.publicKey || !transactpay.encryptionKey)
    ? <Badge tone="red"><AlertIcon className="size-3.5" /> {compact ? "Keys missing" : "Add the public and encryption keys"}</Badge>
    : gatewayBadge(transactpay, compact);
  const saved = s.payment;
  const envNote = (cfg: ResolvedGateway, envName: string) => cfg.source === "environment" ? <Notice tone="accent">Currently using the <code className="font-mono">{envName}</code> environment variable. Keys saved here take priority.</Notice> : null;

  return (
    <ActionForm action={savePayments} className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { name: "Stripe", logo: <Logo text="S" color="#635BFF" />, badge: gatewayBadge(stripe, true), text: "GBP · USD · EUR · CAD" },
          { name: "Paystack", logo: <Logo text="P" color="#0BA4DB" />, badge: gatewayBadge(paystack, true), text: "NGN" },
          { name: "TransactPay", logo: <Logo text="T" color="#1F4ED8" />, badge: transactpayBadge(true), text: transactpay.currencies?.length ? `First for ${transactpay.currencies.join(" · ")}` : "African currencies, detected" },
          { name: "Bank transfer", logo: <span className="flex size-10 items-center justify-center rounded-xl bg-navy text-white"><BankIcon className="size-5" /></span>, badge: bank.enabled ? <Badge tone="green"><CheckCircleIcon className="size-3.5" /> On</Badge> : <Badge>Off</Badge>, text: bank.enabled ? `${bank.currency}, confirmed by admins` : "Manual confirmation" },
        ].map((g) => (
          <div key={g.name} className="flex items-center gap-3 rounded-[14px] border border-edge bg-surface p-4">
            {g.logo}
            <div className="flex min-w-0 flex-col gap-1"><span className="font-semibold text-ink">{g.name}</span><span className="whitespace-nowrap text-xs text-muted">{g.text}</span></div>
            <span className="ml-auto">{g.badge}</span>
          </div>
        ))}
      </div>

      <Section title="Stripe" description="Cards, Apple Pay and Google Pay for GBP, USD, EUR and CAD." icon={<Logo text="S" color="#635BFF" />} badge={gatewayBadge(stripe)}
        footer={<>Find your keys in the <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink">Stripe Dashboard → Developers → API keys</a>. Create the webhook under Developers → Webhooks with the events <code className="font-mono">checkout.session.completed</code> and <code className="font-mono">checkout.session.async_payment_succeeded</code>.</>}>
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

      <Section title="Paystack" description="Card, bank transfer and USSD for NGN. A Paystack account only takes its own country’s currency, so other African currencies go through TransactPay." icon={<Logo text="P" color="#0BA4DB" />} badge={gatewayBadge(paystack)}
        footer={<>Find your keys in the <a href="https://dashboard.paystack.com/#/settings/developers" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink">Paystack Dashboard → Settings → API Keys & Webhooks</a>, and paste the webhook URL there.</>}>
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

      <Section title="TransactPay" description="Card, bank transfer, OPay and mobile money across Africa. When switched on, every currency your TransactPay account takes goes through TransactPay first, with Paystack as the backup." icon={<Logo text="T" color="#1F4ED8" />} badge={transactpayBadge()}
        footer={<>Find all three keys in the <a href="https://app.transactpay.ai/sign-in" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink">TransactPay Dashboard → Settings → API Keys &amp; Webhooks</a> (switch between Test and Live at the top right; each has its own keys). Paste the webhook URL there too.</>}>
        <Switch label="Take payments with TransactPay first" name="transactpayEnabled" defaultChecked={transactpay.enabled} hint="Students paying in a currency TransactPay takes get its checkout. If TransactPay is off, doesn't take a currency or can't start a payment, Paystack (or Stripe) is used instead." />
        {envNote(transactpay, "TRANSACTPAY_SECRET_KEY")}
        <ModePicker name="transactpayMode" value={transactpay.mode} />
        {transactpay.mode === "live" && <Notice tone="amber"><strong>Live mode:</strong> real payments will be taken.</Notice>}
        <div className="grid gap-6 lg:grid-cols-2">
          {(["Test", "Live"] as const).map((m) => {
            const own = saved.transactpay;
            return (
              <div key={m} className="flex flex-col gap-4 rounded-xl border border-edge p-4">
                <p className="text-xs font-semibold uppercase tracking-[1px] text-muted">{m} keys</p>
                <Input label="Public key" name={`transactpay${m}PublicKey`} defaultValue={m === "Test" ? own?.testPublicKey : own?.livePublicKey} placeholder={`PGW-PUBLICKEY-${m.toUpperCase()}-…`} className="[&_input]:font-mono [&_input]:text-sm" />
                <SecretInput label="Secret key" name={`transactpay${m}SecretKey`} masked={maskSecret(m === "Test" ? own?.testSecretKey : own?.liveSecretKey)} placeholder={`PGW-SECRETKEY-${m.toUpperCase()}-…`} />
                <Textarea label="Encryption key" name={`transactpay${m}EncryptionKey`} defaultValue={(m === "Test" ? own?.testEncryptionKey : own?.liveEncryptionKey) ?? ""} rows={3} placeholder="NDA5NiE8UlNBS2V5VmFsdWU+…" hint="A long block of letters and numbers. Used to encrypt checkout requests." className="[&_textarea]:font-mono [&_textarea]:text-xs" />
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-edge bg-panel p-4">
          <p className="text-sm font-semibold text-ink">Currencies TransactPay takes ({transactpay.mode} mode)</p>
          <p className="text-sm text-body">
            {transactpay.currencies?.length
              ? <>{transactpay.currencies.join(", ")}. These go through TransactPay first; everything else (and anything TransactPay can&apos;t start) uses Paystack or Stripe as usual. Checked {new Date(transactpay.checkedAt!).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: s.timezone })}.</>
              : transactpay.secretKey && transactpay.publicKey && transactpay.encryptionKey
                ? "Not checked yet. Save or check again to find out."
                : "Save your keys and we'll ask TransactPay which currencies your account takes (NGN, GHS, KES, UGX…). There's no list to look up, so this starts a small test order in each currency; they're never paid."}
          </p>
          {transactpay.secretKey && transactpay.publicKey && transactpay.encryptionKey && <TransactpayCheckButton />}
        </div>
        <CopyField label="Webhook URL" value={absoluteUrl("/api/webhooks/transactpay")} />
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

      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-4 rounded-[14px] border border-edge bg-surface/95 px-5 py-3 shadow-lg backdrop-blur lg:bottom-4">
        <p className="text-sm text-muted">Secret keys are encrypted before they&apos;re stored and are never shown again in full.</p>
        <SubmitButton>Save payment settings</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ---------- Email ----------

export async function EmailTab({ s }: { s: Settings }) {
  const db = await getDb();
  const [cfg, log, allowance, [{ queued }]] = await Promise.all([
    emailConfig(),
    db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(15),
    sendingAllowance(),
    db.select({ queued: count() }).from(emailLog).where(eq(emailLog.status, "queued")),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <ActionForm action={saveEmailSettings} className="flex flex-col gap-6">
        <Section title="Email delivery" description="Automatic emails (receipts, reminders, feedback) are sent through Resend or your own mail server (SMTP)." icon={<span className="flex size-10 items-center justify-center rounded-xl bg-ink text-white"><MailIcon className="size-5" /></span>}
          badge={cfg.ready ? <Badge tone="green"><CheckCircleIcon className="size-3.5" /> Delivering via {cfg.driver === "smtp" ? "SMTP" : "Resend"}</Badge> : <Badge tone="amber"><AlertIcon className="size-3.5" /> Logging only</Badge>}>
          {!cfg.ready && cfg.driver !== "log" && <Notice tone="amber">{cfg.driver === "smtp" ? "SMTP isn't fully set up yet" : "No Resend API key yet"}, so emails are written to the log below instead of being delivered.</Notice>}
          <EmailDriverFields
            initial={cfg.driver}
            resend={<>
              {cfg.source === "environment" && <Notice tone="accent">Currently using the <code className="font-mono">RESEND_API_KEY</code> environment variable. A key saved here takes priority.</Notice>}
              <SecretInput label="Resend API key" name="apiKey" masked={maskSecret(s.email.apiKey)} placeholder="re_…" />
              <p className="text-xs text-muted">Create an API key at <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink">resend.com/api-keys</a> and verify your domain under Domains so emails come from your own address.</p>
            </>}
            smtp={<>
              <div className="grid gap-5 md:grid-cols-[2fr_1fr_1fr]">
                <Input label="Host" name="smtpHost" defaultValue={s.email.smtpHost} placeholder="smtp.hostinger.com" className="[&_input]:font-mono [&_input]:text-sm" />
                <Input label="Port" name="smtpPort" type="number" min={1} max={65535} defaultValue={s.email.smtpPort ?? 465} />
                <Select label="Encryption" name="smtpSecurity" defaultValue={s.email.smtpSecurity ?? "ssl"} options={[{ value: "ssl", label: "SSL (port 465)" }, { value: "tls", label: "TLS (port 587)" }, { value: "none", label: "None" }]} />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Input label="Username" name="smtpUser" defaultValue={s.email.smtpUser} placeholder="hello@yourdomain.com" autoComplete="off" />
                <SecretInput label="Password" name="smtpPassword" masked={maskSecret(s.email.smtpPassword)} placeholder="Mailbox password" />
              </div>
              <p className="text-xs text-muted"><strong className="text-body">Hostinger:</strong> smtp.hostinger.com, 465, SSL, your full mailbox address and its password. <strong className="text-body">Gmail:</strong> smtp.gmail.com, 587, TLS, with an App Password.</p>
            </>}
            log={<Notice tone="accent">Emails are written to the log below and never delivered. Useful while testing.</Notice>}
          />
          <div className="grid gap-5 md:grid-cols-3">
            <Input label="Sender name" name="fromName" defaultValue={s.email.fromName} placeholder={s.siteName} />
            <Input label="Sender address" name="fromAddress" type="email" defaultValue={s.email.fromAddress} placeholder="hello@yourdomain.com" hint="A domain verified in Resend, or for SMTP usually the mailbox you log in with." />
            <Input label="Reply-to" name="replyTo" type="email" defaultValue={s.email.replyTo} placeholder={s.supportEmail || "support@yourdomain.com"} />
          </div>
          <p className="text-sm text-muted">Emails currently go out as <span className="font-semibold text-ink">{cfg.from}</span>.</p>
        </Section>
        <Section title="Daily sending limit" description="Mail providers cap how many emails a mailbox can send a day (Hostinger and Gmail do). Set your cap a little below theirs: emails over it wait in a queue and go out automatically the next day, instead of failing. Sign-up codes and password resets always go straight away.">
          <div className="grid items-end gap-5 md:grid-cols-[220px_1fr]">
            <Input label="Emails per day" name="dailyLimit" type="number" min={0} step={1} defaultValue={s.email.dailyLimit || ""} placeholder="No limit" />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-2.5 text-sm text-body">
              <span>Sent today: <strong className="text-ink">{allowance.sentToday.toLocaleString()}</strong>{allowance.limit ? <> of {allowance.limit.toLocaleString()}</> : null}</span>
              <span>Waiting in queue: <strong className={queued ? "text-amber-800" : "text-ink"}>{queued.toLocaleString()}</strong></span>
            </div>
          </div>
          {queued > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-[5px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="grow">{queued.toLocaleString()} email{queued === 1 ? " is" : "s are"} waiting. {allowance.remaining === 0 ? "Today's limit is used up, so they'll go out after midnight." : "They go out with the daily job, or now if you like."}</span>
              {allowance.remaining > 0 && <ActionButton action={sendQueuedEmailsNow} pendingText="Sending…" doneText="Done">Send queued emails now</ActionButton>}
            </div>
          )}
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
                <td><Link href={`/admin/emails/log/${e.id}`} className="font-semibold text-ink hover:text-accent-ink">{e.subject}</Link></td>
                <td className="text-muted">{EMAIL_TEMPLATES[e.template as TemplateKey]?.name ?? e.template}</td>
                <td><StatusBadge status={e.status} label={e.status === "logged" ? "Logged only" : e.status === "skipped" ? "Switched off" : e.status === "queued" ? "Queued" : undefined} />{e.error && e.status === "failed" && <p className="mt-1 max-w-[260px] text-xs text-red-700">{e.error}</p>}</td>
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
            <li key={key} className={`rounded-[14px] border bg-surface p-5 transition-colors ${enabled ? "border-edge hover:border-accent-muted" : "border-dashed border-edge-strong bg-panel"}`}>
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
                  <Link href={`/admin/emails/${key}#preview`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-edge-strong bg-surface px-3.5 text-sm font-semibold text-ink hover:bg-page"><EyeIcon className="size-4" /> Preview</Link>
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

// ---------- AI ----------

export async function AiTab({ s }: { s: Settings }) {
  const cfg = await aiConfig();
  const ready = cfg.enabled && Boolean(cfg.key);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
      <ActionForm action={saveAiSettings} className="flex flex-col gap-6">
        <Section title="AI assistant" description="Powers the course advisor, study buddy, grading assistant and writing helper. Every draft is reviewed by a person before it's saved or sent." icon={<span className="flex size-10 items-center justify-center rounded-xl bg-accent text-white"><SparkIcon className="size-5" /></span>}
          badge={ready ? <Badge tone="green"><CheckCircleIcon className="size-3.5" /> On · {cfg.provider === "openai" ? "OpenAI" : "Claude"}</Badge> : cfg.enabled ? <Badge tone="amber"><AlertIcon className="size-3.5" /> No API key</Badge> : <Badge>Off</Badge>}
          footer="Set a monthly spending limit in your provider's dashboard as well. Usage is also capped per person per hour here.">
          <Switch label="Turn on AI features" name="aiEnabled" defaultChecked={cfg.enabled} />
          {cfg.source === "environment" && <Notice tone="accent">Currently using the <code className="font-mono">{cfg.provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"}</code> environment variable. A key saved here takes priority.</Notice>}
          <AiProviderFields
            initial={cfg.provider}
            openai={<>
              <SecretInput label="OpenAI API key" name="openaiApiKey" masked={maskSecret(s.ai?.openaiApiKey)} placeholder="sk-…" />
              <Select label="Model" name="openaiModel" defaultValue={cfg.openaiModel} options={AI_MODELS.openai.map((m) => ({ value: m.id, label: m.label }))} hint="Sol is a good balance. Luna costs far less, which suits the public course advisor; Astra is the most capable." className="max-w-[420px]" />
              <p className="text-xs text-muted">Create a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink">platform.openai.com/api-keys</a> and add credit under Billing.</p>
            </>}
            anthropic={<>
              <SecretInput label="Anthropic API key" name="aiApiKey" masked={maskSecret(s.ai?.apiKey)} placeholder="sk-ant-…" />
              <Select label="Model" name="aiModel" defaultValue={cfg.model} options={AI_MODELS.anthropic.map((m) => ({ value: m.id, label: m.label }))} hint="Opus gives the best answers and grading. Sonnet or Haiku cost less." className="max-w-[420px]" />
              <p className="text-xs text-muted">Create a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink">console.anthropic.com</a>.</p>
            </>}
          />
        </Section>
        <Section title="Features">
          <Switch label="Course advisor" name="aiAdvisor" defaultChecked={cfg.advisor} hint="A “Find your course” chat on the public website that recommends programmes from your catalogue. Limited to 30 questions per visitor per hour." />
          <Switch label="Lesson study buddy" name="aiStudyBuddy" defaultChecked={cfg.studyBuddy} hint="Students can ask questions about each lesson and get quizzed on it. 40 questions per student per hour." />
          <Switch label="Grading assistant" name="aiGrading" defaultChecked={cfg.grading} hint="“Suggest a grade with AI” on submissions: a score and feedback for the instructor to edit. It reads written answers, not attached files." />
          <Switch label="Writing helper" name="aiWriting" defaultChecked={cfg.writing} hint="“Draft with AI” for course descriptions, outcomes, curriculum, announcements and email templates." />
        </Section>
        <div><SubmitButton>Save AI settings</SubmitButton></div>
      </ActionForm>
      <Section title="Check the connection">
        <p className="text-sm text-muted">Save your key first, then send a tiny test request to the chosen provider.</p>
        <ActionForm action={testAiConnection} className="flex flex-col gap-3">
          <SubmitButton pendingText="Testing…">Test connection</SubmitButton>
        </ActionForm>
      </Section>
    </div>
  );
}

// ---------- SEO ----------

export async function SeoTab({ s }: { s: Settings }) {
  const seo = await seoConfig(s);
  const saved = s.seo ?? {};
  const previewTitle = seo.homeTitle || seo.siteName;
  const previewDescription = seo.homeDescription || seo.description;
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
      <ActionForm action={saveSeo} className="flex flex-col gap-6">
        <Section title="Search appearance" description="How your pages look in Google and other search results." icon={<span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink"><SearchIcon className="size-5" /></span>}>
          <Input label="Home page title" name="homeTitle" defaultValue={saved.homeTitle} maxLength={90} placeholder={seo.siteName} hint="The headline for your home page in search results. Aim for under 60 characters, e.g. Tekskillup Academy | Data & Tech Training in Nigeria." />
          <Textarea label="Home page description" name="homeDescription" defaultValue={saved.homeDescription} rows={3} maxLength={300} placeholder={seo.description} hint="The text under the headline. Aim for 120–160 characters that make someone want to click." />
          <Input label="Title pattern for other pages" name="titleTemplate" defaultValue={saved.titleTemplate} maxLength={120} placeholder={`%s | ${seo.siteName}`} hint="%s is replaced by the page name, e.g. “Courses | Tekskillup Academy”." className="[&_input]:font-mono [&_input]:text-sm" />
          <Textarea label="Default description" name="defaultDescription" defaultValue={saved.defaultDescription} rows={2} maxLength={300} placeholder={s.tagline || "Used for pages without their own description."} hint="Used by pages that don't have their own. Defaults to your tagline." />
          <div className="grid gap-5 md:grid-cols-2">
            <Textarea label="Courses page description" name="coursesDescription" defaultValue={saved.coursesDescription} rows={3} maxLength={300} placeholder="Browse live online, in-person and hybrid courses." />
            <Textarea label="Internships page description" name="internshipsDescription" defaultValue={saved.internshipsDescription} rows={3} maxLength={300} placeholder="Hands-on internship programmes…" />
          </div>
          <p className="text-xs text-muted">Each course has its own search title and description on its edit page, under “Search engines”.</p>
        </Section>
        <Section title="Social sharing" description="What people see when your links are shared on WhatsApp, LinkedIn, Facebook or X.">
          <FileField label="Share image" name="shareImage" current={saved.shareImageUrl} removeName="removeShareImage" hint="1200 × 630 px works everywhere. Used for pages without their own image; course pages use their cover image." />
          <Input label="X (Twitter) handle" name="twitterHandle" defaultValue={saved.twitterHandle} maxLength={40} placeholder="@tekskillup" className="max-w-[320px]" />
        </Section>
        <Section title="Search engines">
          <Switch label="Allow search engines to index this site" name="allowIndexing" defaultChecked={seo.allowIndexing} hint="Turn off only for a test copy of the site: it hides every page from Google and Bing." />
          {!seo.allowIndexing && <Notice tone="amber"><strong>Hidden from search engines.</strong> Turn this back on for your live site.</Notice>}
          <div className="grid gap-5 md:grid-cols-2">
            <Input label="Google Search Console verification" name="googleVerification" defaultValue={saved.googleVerification} placeholder="Paste the code or the whole <meta> tag" hint="Search Console → Add property → URL prefix → HTML tag." className="[&_input]:font-mono [&_input]:text-sm" />
            <Input label="Bing Webmaster verification" name="bingVerification" defaultValue={saved.bingVerification} placeholder="Paste the code or the whole <meta> tag" hint="Bing Webmaster Tools → Add site → HTML meta tag." className="[&_input]:font-mono [&_input]:text-sm" />
          </div>
        </Section>
        <Section title="Organisation profile" description="Helps Google connect your social profiles to your academy.">
          <Textarea label="Social profiles" name="socialProfiles" defaultValue={(saved.socialProfiles ?? []).join("\n")} rows={4} placeholder={"https://www.instagram.com/tekskillup\nhttps://www.linkedin.com/company/tekskillup"} hint="One full link per line (Instagram, LinkedIn, Facebook, X, YouTube…)." />
        </Section>
        <div><SubmitButton>Save SEO settings</SubmitButton></div>
      </ActionForm>
      <div className="flex flex-col gap-6">
        <Section title="Google preview" description="Your home page as it would appear in results (from saved settings).">
          <div className="flex flex-col gap-1 rounded-xl border border-edge bg-white p-4 font-[Arial,sans-serif]">
            <span className="text-xs text-[#4d5156]">{absoluteUrl("/").replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
            <span className="text-lg leading-snug text-[#1a0dab]">{previewTitle.length > 60 ? `${previewTitle.slice(0, 60)}…` : previewTitle}</span>
            <span className="text-sm leading-relaxed text-[#4d5156]">{previewDescription ? (previewDescription.length > 160 ? `${previewDescription.slice(0, 160)}…` : previewDescription) : "Add a home page description."}</span>
          </div>
          {previewTitle.length > 60 && <p className="text-xs text-amber-800">The title is {previewTitle.length} characters, so Google will probably cut it off.</p>}
        </Section>
        <Section title="Sitemap">
          <p className="text-sm text-muted">Submit this in Google Search Console and Bing Webmaster Tools so new courses are found quickly. It updates itself.</p>
          <CopyField label="Sitemap" value={absoluteUrl("/sitemap.xml")} />
        </Section>
      </div>
    </div>
  );
}

// ---------- Video ----------

export function VideoTab({ s }: { s: Settings }) {
  const signed = Boolean(s.video?.bunnyTokenKey);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
      <ActionForm action={saveVideoSettings} className="flex flex-col gap-6">
        <Section title="Bunny Stream protection" description="Optional. Signs lesson video links so they expire after a few hours and can't be shared or embedded elsewhere."
          badge={signed ? <Badge tone="green"><CheckCircleIcon className="size-3.5" /> Signed links on</Badge> : <Badge>Off</Badge>}>
          <SecretInput label="Token authentication key" name="bunnyTokenKey" masked={maskSecret(s.video?.bunnyTokenKey)} placeholder="Paste the key from Bunny" hint="Bunny dashboard → Stream → your video library → Security → Embed view token authentication." />
          <Notice tone="amber">Turn on <strong>Embed view token authentication</strong> in Bunny only after saving the key here, otherwise lesson videos will stop playing.</Notice>
        </Section>
        <div><SubmitButton>Save video settings</SubmitButton></div>
      </ActionForm>
      <Section title="How lesson videos work">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-body">
          <li>Record the lesson and upload it to your Bunny Stream library.</li>
          <li>Open the video in Bunny and copy its embed or play link.</li>
          <li>Paste it into the lesson&apos;s <strong>Video link</strong> (Teach → cohort → Learning, or Courses → module → lesson).</li>
          <li>Publish the lesson. Students watch it inside the lesson page and mark it complete.</li>
        </ol>
        <p className="text-xs text-muted">Also add your website under <strong>Allowed domains</strong> in Bunny&apos;s Security settings so the player only works on your site. YouTube, Vimeo and Loom links play inside lessons too.</p>
      </Section>
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
        <Section title="Class reminders" description="Sent by email and in-app to every active student in the cohort." icon={<span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink"><ClockIcon className="size-5" /></span>}>
          <Switch label="The day before" name="dayBefore" defaultChecked={r.dayBefore} hint="Sent within 24 hours of each class." />
          <Switch label="Shortly before class starts" name="hourBefore" defaultChecked={r.hourBefore} hint="Includes the joining link or venue." />
          <Input label="Minutes before class" name="hourLeadMinutes" type="number" min={15} max={360} step={5} defaultValue={r.hourLeadMinutes} className="max-w-[240px]" />
        </Section>
        <Section title="Assignment deadlines" description="Only students who haven't submitted are reminded.">
          <Switch label="Remind before the deadline" name="assignmentDue" defaultChecked={r.assignmentDue} />
          <Input label="Hours before the deadline" name="assignmentLeadHours" type="number" min={1} max={168} defaultValue={r.assignmentLeadHours} className="max-w-[240px]" />
        </Section>
        <p className="text-sm text-muted">Students can turn reminder emails off in their account; in-app notifications are always created. The wording is in the <Link href="/admin/settings?tab=templates" className="font-semibold text-accent-ink">Class reminder</Link> and <Link href="/admin/settings?tab=templates" className="font-semibold text-accent-ink">Assignment due soon</Link> templates.</p>
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

// ---------- Referrals ----------

export async function ReferralsTab() {
  const r = await referralConfig();
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
      <ActionForm action={saveReferralSettings} className="flex flex-col gap-6">
        <Section title="Refer & earn" description="Anyone with an account gets a personal link. When someone new joins through it and pays for a course, the person who shared it earns a commission." badge={r.enabled ? <Badge tone="green"><CheckCircleIcon className="size-3.5" /> On</Badge> : <Badge>Off</Badge>}>
          <Switch label="Turn on referrals" name="enabled" defaultChecked={r.enabled} hint="Shows Refer & earn to everyone in their account menu." />
          <div className="grid gap-5 md:grid-cols-3">
            <Input label="Commission (%)" name="percent" type="number" min={0} max={100} defaultValue={r.percent} hint="Of what the referred student pays. Each course can override it." />
            <Input label="Link remembered for (days)" name="cookieDays" type="number" min={1} max={365} defaultValue={r.cookieDays} hint="How long after clicking a link the sign-up still counts." />
            <Input label="Payable after (days)" name="holdDays" type="number" min={0} max={180} defaultValue={r.holdDays} hint="Waiting period, so refunds can happen before you pay out." />
          </div>
          <Select label="Commission is paid on" name="scope" defaultValue={r.scope} options={[{ value: "first", label: "The first course a referred student buys (including its deposit and balance)" }, { value: "all", label: "Every course a referred student ever buys" }]} />
          <Textarea label="Extra terms (optional)" name="terms" defaultValue={r.terms} rows={4} hint="Shown on everyone's Refer & earn page, e.g. how and when you pay out." />
        </Section>
        <div><SubmitButton>Save referral settings</SubmitButton></div>
      </ActionForm>
      <Section title="How it works">
        <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-body">
          <li><strong className="text-ink">Only new people count.</strong> The referral is attached when someone creates an account (signing up or enrolling) after using a link. Existing accounts and self-referrals never count.</li>
          <li><strong className="text-ink">Commission follows the money.</strong> It&apos;s worked out on what the student actually pays, after discounts, in the same currency.</li>
          <li><strong className="text-ink">Refunds are handled.</strong> A refund reduces the commission, or cancels it when the refund is full.</li>
          <li><strong className="text-ink">You pay out.</strong> Payable commissions and each person&apos;s bank details are under <Link href="/admin/referrals" className="font-semibold text-accent-ink">Payments › Referrals</Link>, where you mark them paid.</li>
        </ul>
      </Section>
    </div>
  );
}
