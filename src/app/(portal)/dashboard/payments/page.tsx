import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { payBalance } from "@/app/actions/enroll";
import { ActionForm, SubmitButton } from "@/components/forms";
import { CardIcon } from "@/components/icons";
import { Card, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courses, payments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { payableCurrencies, paymentBalanceFor } from "@/lib/payments";
import { formatDateTime, hoursAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const [user, settings] = await Promise.all([requireUser(), getSettings()]);
  const db = await getDb();
  const rows = await db.select().from(payments).where(eq(payments.userId, user.id)).orderBy(desc(payments.createdAt));
  const payable = await payableCurrencies();
  const depositKeys = [...new Map(rows.filter((p) => p.status === "paid" && p.paymentPlan === "deposit" && p.cohortId).map((p) => [`${p.cohortId}:${p.currency}`, p])).values()];
  const balances = (await Promise.all(depositKeys.map(async (deposit) => {
    const [detail] = await db.select({ cohort: cohorts, course: courses }).from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(eq(cohorts.id, deposit.cohortId!));
    if (!detail) return null;
    return { ...detail, balance: await paymentBalanceFor(user.id, detail.cohort, deposit.currency) };
  }))).filter((row): row is NonNullable<typeof row> => Boolean(row?.balance.remaining));
  const cutoff = hoursAgo(24);
  const visible = rows.filter((p) => p.status !== "pending" || p.gateway === "manual" || new Date(p.createdAt) > cutoff);
  return (
    <>
      <PageHeader title="Payments" description="Your payment history and references. Receipts are emailed after each payment." />
      {balances.length > 0 && <div className="grid gap-4 md:grid-cols-2">{balances.map(({ cohort, course, balance }) => <Card key={`${cohort.id}:${balance.currency}`} className="border-amber-200 bg-amber-50/30">
        <p className="text-xs font-bold uppercase tracking-[1.2px] text-amber-800">Balance due</p>
        <h2 className="mt-2 font-display text-lg font-bold text-ink">{course.title}</h2><p className="text-sm text-muted">{cohort.name}</p>
        <div className="mt-4 flex items-end justify-between gap-4"><div><p className="font-display text-2xl font-bold text-ink">{formatMoney(balance.remaining, balance.currency)}</p><p className="text-xs text-muted">{formatMoney(balance.paid, balance.currency)} paid of {formatMoney(balance.total, balance.currency)}</p></div>
        {payable.includes(balance.currency) ? <ActionForm action={payBalance.bind(null, cohort.id, balance.currency)} className="items-end"><SubmitButton pendingText="Opening…">Pay balance</SubmitButton></ActionForm> : <p className="max-w-40 text-right text-xs text-muted">Online payments in {balance.currency} are currently unavailable. Contact support.</p>}</div>
      </Card>)}</div>}
      {visible.length ? (
        <DataTable>
          <thead><tr><th>Date</th><th>For</th><th>Amount</th><th>Plan</th><th>Status</th><th>Reference</th></tr></thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap text-muted">{formatDateTime(p.paidAt ?? p.createdAt, settings.timezone, { zone: false })}</td>
                <td className="font-semibold text-ink">{p.description}</td>
                <td className="whitespace-nowrap font-semibold">{formatMoney(p.amount, p.currency)}</td>
                <td className="capitalize text-muted">{p.paymentPlan}</td>
                <td><StatusBadge status={p.status} label={p.status === "pending" && p.gateway === "manual" ? "Awaiting transfer" : undefined} />{p.status === "pending" && p.gateway === "manual" && <Link href={`/checkout/transfer?ref=${p.reference}`} className="mt-1 block text-xs font-semibold text-accent">Bank details →</Link>}</td>
                <td className="font-mono text-xs text-muted">{p.reference}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState icon={CardIcon} title="No payments yet">When you enrol on a paid cohort, your receipts will be listed here.</EmptyState>
      )}
    </>
  );
}
