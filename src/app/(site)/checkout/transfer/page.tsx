import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CopyField } from "@/components/copy-field";
import { BankIcon, ClockIcon } from "@/components/icons";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { bankTransferConfig } from "@/lib/config";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Bank transfer", robots: { index: false } };

export default async function TransferPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref = "" } = await searchParams;
  const user = await requireUser();
  const [payment] = await (await getDb()).select().from(payments).where(and(eq(payments.reference, ref), eq(payments.userId, user.id), eq(payments.gateway, "manual")));
  if (!payment) notFound();
  const bank = await bankTransferConfig();

  if (payment.status === "paid") {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col items-center gap-4 px-5 py-20 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">Transfer received</h1>
        <p className="text-lg text-muted">Your place is confirmed. See you in class!</p>
        {payment.cohortId && <Link href={`/dashboard/cohorts/${payment.cohortId}`} className="flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-white hover:bg-accent-dark">Go to my class</Link>}
      </div>
    );
  }

  const rows = [
    { label: "Account name", value: bank.accountName },
    { label: "Bank", value: bank.bankName },
    { label: "Account number", value: bank.accountNumber },
    ...(bank.sortCode ? [{ label: "Sort code / routing", value: bank.sortCode }] : []),
  ];

  return (
    <div className="mx-auto flex max-w-[620px] flex-col gap-6 px-5 py-14 md:py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent"><BankIcon className="size-7" /></span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Pay by bank transfer</h1>
        <p className="text-muted">{payment.description}</p>
      </div>
      <div className="flex flex-col gap-5 rounded-[18px] border border-edge bg-white p-6 md:p-7">
        <div className="flex items-baseline justify-between gap-3 border-b border-line pb-5">
          <span className="text-sm font-semibold text-muted">Amount to send</span>
          <span className="font-display text-3xl font-bold text-ink">{formatMoney(payment.amount, payment.currency)}</span>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-0.5 rounded-xl bg-panel p-3.5">
              <dt className="text-xs font-semibold uppercase tracking-[1px] text-muted">{r.label}</dt>
              <dd className="font-semibold text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
        <CopyField label="Payment reference (use as the transfer description)" value={payment.reference} />
        {bank.instructions && <p className="text-sm leading-relaxed text-body">{bank.instructions}</p>}
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900"><ClockIcon className="mt-0.5 size-4 shrink-0" /> Your place is reserved and will be confirmed by email as soon as we receive the transfer.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/dashboard" className="flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-white hover:bg-accent-dark">Go to my dashboard</Link>
        <Link href="/dashboard/payments" className="flex h-12 items-center rounded-lg border border-edge-strong bg-white px-6 font-semibold text-ink hover:bg-page">My payments</Link>
      </div>
    </div>
  );
}
