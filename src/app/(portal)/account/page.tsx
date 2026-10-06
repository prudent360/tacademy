import type { Metadata } from "next";
import QRCode from "qrcode";
import { cancelTwoFactorSetup, changePassword, confirmTwoFactor, disableTwoFactor, startTwoFactorSetup, updateProfile } from "@/app/actions/account";
import { ActionButton, ActionForm, Checkbox, FileField, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import type { User } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { whatsappConfig } from "@/lib/whatsapp";
import { getSettings } from "@/lib/data";
import { decryptSecret } from "@/lib/secrets";
import { formatDateTime } from "@/lib/time";
import { formatSecret, otpauthUrl } from "@/lib/totp";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { GENDER_OPTIONS, studentId } from "@/lib/utils";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ twofactor?: string }> }) {
  const [user, settings, { twofactor }, whatsapp] = await Promise.all([requireUser(), getSettings(), searchParams, whatsappConfig()]);
  const twoFactorRequired = settings.requireStaffTwoFactor && (user.role === "admin" || user.role === "staff");
  return (
    <>
      <PageHeader title="Account" description={`Signed in as ${user.email}${user.role === "student" ? ` · Student ID ${studentId(user)}` : ""}`} />
      {twofactor === "required" && !user.totpEnabledAt && <Notice tone="amber">The academy requires two-factor sign-in for administrators and team members. Set it up below to open the admin area.</Notice>}
      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Profile">
          <ActionForm action={updateProfile}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Full name" name="name" defaultValue={user.name} required />
              <Input label="Phone" name="phone" type="tel" defaultValue={user.phone} hint="Used by the academy for class updates." />
            </div>
            <Select label="Gender" name="gender" defaultValue={user.gender ?? ""} options={GENDER_OPTIONS.map((g) => ({ value: g.value, label: g.label }))} hint="Optional. Without a photo, your avatar is an illustration based on this." className="max-w-[320px]" />
            {user.role !== "student" && <Textarea label="Short bio" name="bio" defaultValue={user.bio} hint="Shown on course pages you teach." />}
            <FileField label="Profile photo" name="avatar" current={user.avatarUrl} removeName="removeAvatar" />
            <Checkbox label="Email me class and deadline reminders" name="emailReminders" defaultChecked={user.emailReminders} hint="Receipts, feedback and account emails are always sent." />
            {/* Marks that the WhatsApp box was on the form, so an unticked box turns it off (and a hidden one leaves it alone). */}
            {whatsapp.ready && <input type="hidden" name="whatsappShown" value="1" />}
            {whatsapp.ready && <Checkbox label="Send me reminders and receipts on WhatsApp" name="whatsappOptIn" defaultChecked={user.whatsappOptIn} hint="Sent to the phone number above. Include your country code, e.g. +234 803 123 4567." />}
            <SubmitButton>Save profile</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="Change password">
          <ActionForm action={changePassword} resetOnSuccess>
            <Input label="Current password" name="current" type="password" autoComplete="current-password" required />
            <Input label="New password" name="next" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} />
            <Input label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
            <SubmitButton>Update password</SubmitButton>
          </ActionForm>
        </Card>
      </div>
      <div id="two-factor" className="scroll-mt-24">
        <TwoFactorCard user={user} required={twoFactorRequired} siteName={settings.siteName} timezone={settings.timezone} />
      </div>
    </>
  );
}

/** Set up, or switch off, two-factor sign-in with an authenticator app. */
async function TwoFactorCard({ user, required, siteName, timezone }: { user: User; required: boolean; siteName: string; timezone: string }) {
  if (user.totpEnabledAt) {
    return (
      <Card title="Two-factor sign-in" action={<Badge tone="green">On</Badge>}>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-body">Switched on {formatDateTime(user.totpEnabledAt, timezone, { zone: false })}. You&apos;re asked for a code from your authenticator app each time you sign in.</p>
          {required ? <Notice tone="accent">The academy requires two-factor sign-in for administrators and team members, so it stays on.</Notice> : (
            <ActionForm action={disableTwoFactor} className="flex flex-wrap items-end gap-3">
              <Input label="Code from your app, to switch it off" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="max-w-[240px]" />
              <SubmitButton pendingText="Switching off…">Switch off</SubmitButton>
            </ActionForm>
          )}
        </div>
      </Card>
    );
  }
  if (!user.totpSecret) {
    return (
      <Card title="Two-factor sign-in" action={<Badge tone={required ? "amber" : "neutral"}>{required ? "Required" : "Off"}</Badge>}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-[640px] text-sm text-body">Protect your account with a 6-digit code from an app such as Google Authenticator, Microsoft Authenticator or 1Password, as well as your password.{required && " The academy requires this for administrators and team members before you can use the admin area."}</p>
          <ActionButton action={startTwoFactorSetup} variant="primary" pendingText="Preparing…">Set up two-factor sign-in</ActionButton>
        </div>
      </Card>
    );
  }
  const secret = decryptSecret(user.totpSecret);
  const qr = await QRCode.toDataURL(otpauthUrl(siteName, user.email, secret), { width: 200, margin: 1, color: { dark: "#181340", light: "#ffffff" } });
  return (
    <Card title="Set up two-factor sign-in" action={<ActionButton action={cancelTwoFactorSetup} pendingText="…">Cancel</ActionButton>}>
      <div className="grid items-center gap-6 md:grid-cols-[auto_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code to add this account to your authenticator app" width={180} height={180} className="rounded-[5px] border border-edge" />
        <div className="flex flex-col gap-4">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-body">
            <li>Open your authenticator app and add an account.</li>
            <li>Scan this QR code, or type the key: <code className="rounded bg-page px-1.5 py-0.5 font-mono text-[13px] text-ink">{formatSecret(secret)}</code></li>
            <li>Enter the 6-digit code it shows.</li>
          </ol>
          <ActionForm action={confirmTwoFactor} className="flex flex-wrap items-end gap-3">
            <Input label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="max-w-[200px]" />
            <SubmitButton>Switch on</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </Card>
  );
}
