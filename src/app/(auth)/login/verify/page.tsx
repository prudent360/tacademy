import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyTwoFactorSignIn } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ShieldIcon } from "@/components/icons";
import { PENDING_COOKIE, verifyPendingSignIn } from "@/lib/session";

export const metadata: Metadata = { title: "Enter your code", robots: { index: false } };

/** Step two of signing in, for accounts with two-factor sign-in switched on. */
export default async function VerifySignInPage() {
  if (!(await verifyPendingSignIn((await cookies()).get(PENDING_COOKIE)?.value))) redirect("/login");
  return (
    <>
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-[5px] bg-accent-soft text-accent"><ShieldIcon className="size-6" /></span>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.6px] text-ink">Enter your code</h1>
        <p className="text-[15px] text-muted">Open your authenticator app and type the 6-digit code for this academy.</p>
      </div>
      <ActionForm action={verifyTwoFactorSignIn}>
        <label className="flex flex-col gap-2 text-sm font-medium text-ink">
          6-digit code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus placeholder="123 456" className="h-14 rounded-[5px] border border-edge-strong bg-white px-4 text-center font-mono text-2xl tracking-[.4em] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
        </label>
        <SubmitButton pendingText="Checking…" block>Verify and sign in</SubmitButton>
      </ActionForm>
      <p className="text-center text-sm text-muted">Lost your phone? Ask an administrator to reset two-factor sign-in for you. <Link href="/login" className="font-semibold text-accent hover:text-accent-dark">Back to sign in</Link></p>
    </>
  );
}
