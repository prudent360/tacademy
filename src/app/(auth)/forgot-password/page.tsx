import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { ActionForm, Input, SubmitButton } from "@/components/forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.6px] text-ink">Reset your password</h1>
        <p className="text-sm text-muted">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      </div>
      <ActionForm action={requestPasswordReset}>
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <SubmitButton pendingText="Sending…" block>Send reset link</SubmitButton>
      </ActionForm>
      <p className="text-center text-sm text-muted"><Link href="/login" className="font-semibold text-accent hover:text-accent-dark">Back to sign in</Link></p>
    </>
  );
}
