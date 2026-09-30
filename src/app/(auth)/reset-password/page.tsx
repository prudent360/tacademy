import type { Metadata } from "next";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { ActionForm, Input, SubmitButton } from "@/components/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { peekToken } from "@/lib/tokens";

export const metadata: Metadata = { title: "Choose a password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = Boolean(await peekToken(token, ["reset", "invite"]));
  if (!valid) {
    return (
      <>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.6px] text-ink">This link has expired</h1>
        <p className="text-[15px] text-muted">Password links work once and expire after a while. Request a fresh one below.</p>
        <Link href="/forgot-password" className="flex h-11 w-fit items-center rounded-lg bg-accent px-5 font-semibold text-white hover:bg-accent-dark">Request a new link</Link>
      </>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.6px] text-ink">Choose a password</h1>
        <p className="text-sm text-muted">You&apos;ll be signed in straight after.</p>
      </div>
      <ActionForm action={resetPassword}>
        <input type="hidden" name="token" value={token} />
        <Input label="New password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} />
        <Input label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
        <SubmitButton pendingText="Saving…" block>Save and sign in</SubmitButton>
      </ActionForm>
    </>
  );
}
