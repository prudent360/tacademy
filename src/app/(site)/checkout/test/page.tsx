import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { completeTestPayment } from "@/app/actions/checkout";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { canViewPayment } from "@/lib/checkout-access";
import { formatMoney, gatewayFor } from "@/lib/money";
import { testPaymentsAllowed } from "@/lib/payments";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false } };

/** Stand-in for Stripe/Paystack during local development, when no gateway keys are set. */
export default async function TestCheckoutPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  if (!testPaymentsAllowed()) notFound();
  const { ref = "" } = await searchParams;
  const [payment] = await (await getDb()).select().from(payments).where(eq(payments.reference, ref));
  if (!payment || !(await canViewPayment(payment)).allowed) notFound();
  const gateway = gatewayFor(payment.currency) === "stripe" ? "Stripe" : "Paystack";

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 px-5 py-16">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Test mode.</strong> No {gateway} keys are configured, so this page simulates the {gateway} checkout. It is never shown in production.
      </div>
      <div className="flex flex-col gap-5 rounded-[14px] border border-edge bg-white p-7">
        <p className="font-mono text-xs uppercase tracking-wider text-muted">{gateway} checkout (simulated)</p>
        <p className="text-[15px] text-body">{payment.description}</p>
        <p className="font-display text-4xl font-bold text-ink">{formatMoney(payment.amount, payment.currency)}</p>
        <form action={completeTestPayment.bind(null, payment.reference)}>
          <button type="submit" className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-accent font-semibold text-white hover:bg-accent-dark">Simulate successful payment</button>
        </form>
        <Link href="/courses" className="text-center text-sm font-semibold text-muted hover:text-ink">Cancel</Link>
      </div>
    </div>
  );
}
