import type { Metadata } from "next";
import Link from "next/link";
import { currentHome, verifyEmailToken } from "@/app/actions/auth";
import { CheckIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const ok = await verifyEmailToken(token);
  const home = (await currentHome()) ?? "/login";
  return ok ? (
    <>
      <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon className="size-6" /></span>
      <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.6px] text-ink">Email confirmed</h1>
      <p className="text-[15px] text-muted">Thanks! You&apos;ll now receive class reminders, feedback and receipts.</p>
      <Link href={home} className="flex h-11 w-fit items-center rounded-lg bg-accent px-5 font-semibold text-white hover:bg-accent-dark">Continue</Link>
    </>
  ) : (
    <>
      <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.6px] text-ink">This link has expired</h1>
      <p className="text-[15px] text-muted">It may have been used already. Sign in and use &ldquo;Resend confirmation email&rdquo; on your dashboard to get a new one.</p>
      <Link href={home} className="flex h-11 w-fit items-center rounded-lg bg-accent px-5 font-semibold text-white hover:bg-accent-dark">Go to my account</Link>
    </>
  );
}
