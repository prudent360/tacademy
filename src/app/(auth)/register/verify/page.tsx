import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { resendEmailCode, verifyEmailCode } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MailIcon } from "@/components/icons";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { VERIFY_COOKIE, verifyPendingVerification } from "@/lib/session";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

/** After sign-up: the 6-digit code we emailed them. */
export default async function VerifyEmailCodePage() {
  const pending = await verifyPendingVerification((await cookies()).get(VERIFY_COOKIE)?.value);
  if (!pending) redirect("/login");
  const [user] = await (await getDb()).select({ email: users.email }).from(users).where(eq(users.id, pending.userId));
  if (!user) redirect("/login");
  return (
    <>
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-[5px] bg-accent-soft text-accent"><MailIcon className="size-6" /></span>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.6px] text-ink">Check your email</h1>
        <p className="text-[15px] text-muted">We&apos;ve sent a 6-digit code to <strong className="font-semibold text-ink">{user.email}</strong>. Enter it below to confirm your email. It expires in 10 minutes.</p>
      </div>
      <ActionForm action={verifyEmailCode}>
        <label className="flex flex-col gap-2 text-sm font-medium text-ink">
          6-digit code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus placeholder="123 456" className="h-14 rounded-[5px] border border-edge-strong bg-white px-4 text-center font-mono text-2xl tracking-[.4em] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
        </label>
        <SubmitButton pendingText="Checking…" block>{pending.welcome ? "Confirm and create account" : "Confirm and sign in"}</SubmitButton>
      </ActionForm>
      <ActionForm action={resendEmailCode} className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted">Didn&apos;t get it? Check your spam folder, or <button type="submit" className="cursor-pointer font-semibold text-accent hover:text-accent-dark">send a new code</button>.</p>
      </ActionForm>
      <p className="text-center text-sm text-muted">Wrong email? <Link href="/register" className="font-semibold text-accent hover:text-accent-dark">Start again</Link></p>
    </>
  );
}
