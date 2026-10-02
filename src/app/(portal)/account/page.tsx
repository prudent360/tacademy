import type { Metadata } from "next";
import { changePassword, updateProfile } from "@/app/actions/account";
import { ActionForm, Checkbox, FileField, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { GENDER_OPTIONS, studentId } from "@/lib/utils";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Account" description={`Signed in as ${user.email}${user.role === "student" ? ` · Student ID ${studentId(user)}` : ""}`} />
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
    </>
  );
}
