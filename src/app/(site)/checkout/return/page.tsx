import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { CheckIcon, ClockIcon } from "@/components/icons";
import { canViewPayment } from "@/lib/checkout-access";
import { formatMoney } from "@/lib/money";
import { verifyPayment } from "@/lib/payments";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default async function CheckoutReturnPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref = "" } = await searchParams;
  const payment = await verifyPayment(ref);
  if (!payment) notFound();
  const { allowed, signedIn } = await canViewPayment(payment);
  if (!allowed) notFound();
  const [owner] = await (await getDb()).select({ email: users.email, passwordHash: users.passwordHash }).from(users).where(eq(users.id, payment.userId));
  const needsPassword = !signedIn && !owner?.passwordHash;

  const paid = payment.status === "paid";
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-5 px-5 py-20 text-center">
      <span className={`flex size-16 items-center justify-center rounded-full ${paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
        {paid ? <CheckIcon className="size-8" /> : <ClockIcon className="size-8" />}
      </span>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{paid ? "Payment successful" : payment.status === "failed" ? "Payment didn't go through" : "Confirming your payment"}</h1>
      <p className="text-lg text-muted">
        {paid
          ? <>You paid {formatMoney(payment.amount, payment.currency)} for {payment.description}. Your place is confirmed and a receipt is on its way to {owner?.email}.{needsPassword && <> We&apos;ve also emailed you a link to set your password and open your student dashboard.</>}</>
          : payment.status === "failed"
            ? "You haven't been charged. Please try again or use a different payment method."
            : "We're waiting for the payment provider to confirm. This usually takes a few seconds; refresh this page or check your dashboard shortly."}
      </p>
      <p className="font-mono text-xs text-muted">Reference {payment.reference}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {paid && payment.cohortId && signedIn ? (
          <Link href={`/dashboard/cohorts/${payment.cohortId}?welcome=1`} className="flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-white hover:bg-accent-dark">Go to my class</Link>
        ) : paid ? (
          <Link href="/login" className="flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-white hover:bg-accent-dark">Sign in</Link>
        ) : (
          <Link href={`/checkout/return?ref=${payment.reference}`} className="flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-white hover:bg-accent-dark">Check again</Link>
        )}
        {signedIn && <Link href="/dashboard/payments" className="flex h-12 items-center rounded-lg border border-edge-strong bg-white px-6 font-semibold text-ink hover:bg-page">My payments</Link>}
      </div>
    </div>
  );
}
