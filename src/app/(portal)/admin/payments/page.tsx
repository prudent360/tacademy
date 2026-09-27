import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { markPaymentFailed, markPaymentPaid, recheckPayment, recordOfflinePayment, sendBalanceReminder } from "@/app/actions/admin";
import { ActionButton, ActionForm, Input, ModalButton, Select, SubmitButton } from "@/components/forms";
import { BankIcon, CardIcon, CheckCircleIcon, ClockIcon, DownloadIcon, PlusIcon, TrendIcon, XCircleIcon } from "@/components/icons";
import { StatTile } from "@/components/portal/dash";
import { DataTable, EmptyState, PageHeader, Pagination, PersonCell, StatusBadge, TableToolbar, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courses, payments, users } from "@/db/schema";
import { listPayments, parsePaymentFilters, paymentSummary } from "@/lib/admin-payments";
import { getSettings } from "@/lib/data";
import { CURRENCIES, formatMoney } from "@/lib/money";
import { paymentBalanceFor } from "@/lib/payments";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Payments" };

const PAGE_SIZE = 25;
const GATEWAY = {
  stripe: { label: "Stripe", color: "#635BFF", short: "S" },
  paystack: { label: "Paystack", color: "#0BA4DB", short: "P" },
  manual: { label: "Bank / offline", color: "#19112E", short: "B" },
  test: { label: "Test", color: "#8b8598", short: "T" },
} as const;

type Search = { status?: string; gateway?: string; q?: string; page?: string };

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const filters = parsePaymentFilters(params);
  const page = Math.max(1, Number(params.page) || 1);
  const db = await getDb();
  const [settings, summary, { rows, total }, cohortOptions, deposits] = await Promise.all([
    getSettings(),
    paymentSummary(),
    listPayments(filters, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    db.select({ id: cohorts.id, name: cohorts.name, course: courses.title }).from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId)).orderBy(asc(courses.title), desc(cohorts.startDate)),
    db.select({ payment: payments, user: users, cohort: cohorts, course: courses }).from(payments).innerJoin(users, eq(users.id, payments.userId)).innerJoin(cohorts, eq(cohorts.id, payments.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(and(eq(payments.status, "paid"), eq(payments.paymentPlan, "deposit"))).orderBy(desc(payments.paidAt)),
  ]);
  const uniqueDeposits = [...new Map(deposits.map((row) => [`${row.user.id}:${row.cohort.id}:${row.payment.currency}`, row])).values()];
  const outstanding = (await Promise.all(uniqueDeposits.map(async (row) => ({ ...row, balance: await paymentBalanceFor(row.user.id, row.cohort, row.payment.currency) })))).filter((row) => row.balance.remaining > 0);
  const primary = settings.currencies[0] ?? "GBP";
  const primaryRevenue = summary.revenue.find((r) => r.currency === primary)?.total ?? 0;
  const otherRevenue = summary.revenue.filter((r) => r.currency !== primary);

  const url = (next: Partial<Search>) => {
    const merged = { status: filters.status, gateway: filters.gateway, q: filters.q, page: undefined as string | undefined, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/admin/payments?${qs}` : "/admin/payments";
  };
  const exportQs = new URLSearchParams(Object.entries({ status: filters.status, gateway: filters.gateway, q: filters.q }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Payments"
        description="Card payments confirm automatically through Stripe and Paystack. Confirm bank transfers here once the money arrives."
        actions={<>
          <a href={`/api/admin/payments/export${exportQs ? `?${exportQs}` : ""}`} className={buttonClass.secondary}><DownloadIcon className="size-4" /> Export CSV</a>
          <ModalButton label="Record payment" title="Record an offline payment" icon={<PlusIcon className="size-4" />}>
            <ActionForm action={recordOfflinePayment} resetOnSuccess>
              <p className="text-sm text-muted">For bank transfers or cash received outside the checkout. The student is enrolled and emailed a receipt; new emails get an account invitation.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Student email" name="email" type="email" required />
                <Input label="Name (new accounts)" name="name" />
              </div>
              <Select label="Cohort" name="cohortId" options={[{ value: "", label: "Choose a cohort" }, ...cohortOptions.map((c) => ({ value: String(c.id), label: `${c.course}: ${c.name}` }))]} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Currency" name="currency" defaultValue={primary} options={CURRENCIES.map((c) => ({ value: c.code, label: c.code }))} />
                <Input label="Amount received" name="amount" inputMode="decimal" required />
              </div>
              <Input label="Note" name="note" placeholder="Bank transfer, 26 Sep" />
              <SubmitButton pendingText="Recording…">Record and enrol</SubmitButton>
            </ActionForm>
          </ModalButton>
        </>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label={`Revenue (${primary})`} value={formatMoney(primaryRevenue, primary)} icon={TrendIcon} tone="green" hint={otherRevenue.length ? `+ ${otherRevenue.map((r) => formatMoney(r.total, r.currency)).join(" · ")}` : "All time"} />
        <StatTile label="Transactions" value={summary.total} icon={CardIcon} tone="purple" href="/admin/payments" />
        <StatTile label="Successful" value={summary.paid} icon={CheckCircleIcon} tone="cyan" href={url({ status: "paid" })} />
        <StatTile label="Pending" value={summary.pending} icon={ClockIcon} tone="amber" href={url({ status: "pending" })} />
        <StatTile label="Failed" value={summary.failed} icon={XCircleIcon} tone="red" href={url({ status: "failed" })} />
      </div>

      {outstanding.length > 0 && <section className="rounded-[5px] border border-amber-200 bg-amber-50/30 p-5 md:p-6"><div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-display text-lg font-bold text-ink">Outstanding course balances</h2><p className="mt-1 text-sm text-muted">Students who reserved a place with a deposit and still have a balance due.</p></div><span className="text-sm font-semibold text-amber-800">{outstanding.length} outstanding</span></div><div className="grid gap-3 lg:grid-cols-2">{outstanding.slice(0, 6).map(({ user, cohort, course, balance }) => <div key={`${user.id}:${cohort.id}:${balance.currency}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[5px] border border-amber-200 bg-white p-4"><div className="min-w-0"><Link href={`/admin/users/${user.id}`} className="font-semibold text-ink hover:text-accent">{user.name}</Link><p className="truncate text-sm text-muted">{course.title} · {cohort.name}</p><p className="mt-1 text-xs text-muted">Paid {formatMoney(balance.paid, balance.currency)} of {formatMoney(balance.total, balance.currency)}</p></div><div className="flex items-center gap-3"><span className="font-display text-lg font-bold text-amber-800">{formatMoney(balance.remaining, balance.currency)}</span><ActionButton action={sendBalanceReminder.bind(null, user.id, cohort.id, balance.currency)} pendingText="Sending…" doneText="Sent">Remind</ActionButton></div></div>)}</div></section>}

      <TableToolbar
        action="/admin/payments"
        q={filters.q}
        placeholder="Search reference, student or course…"
        hidden={{ status: filters.status, gateway: filters.gateway }}
        filters={[
          { label: "All", href: url({ status: undefined }), active: !filters.status },
          { label: "Successful", href: url({ status: "paid" }), active: filters.status === "paid" },
          { label: "Pending", href: url({ status: "pending" }), active: filters.status === "pending", count: summary.pending || undefined },
          { label: "Failed", href: url({ status: "failed" }), active: filters.status === "failed" },
        ]}
        right={
          <div className="flex flex-wrap gap-1.5 lg:border-l lg:border-line lg:pl-3">
            {(["stripe", "paystack", "manual"] as const).map((g) => (
              <Link key={g} href={url({ gateway: filters.gateway === g ? undefined : g })} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-semibold ${filters.gateway === g ? "border-accent bg-accent-soft text-accent" : "border-edge text-muted hover:text-ink"}`}>
                <span className="size-2 rounded-full" style={{ background: GATEWAY[g].color }} /> {GATEWAY[g].label}
              </Link>
            ))}
          </div>
        }
      />

      {rows.length ? (
        <>
          <DataTable>
            <thead><tr><th>Date & reference</th><th>Student</th><th>Description</th><th>Amount</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map(({ payment: p, user: u }) => {
                const g = GATEWAY[p.gateway];
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap"><span className="block text-body">{formatDateTime(p.paidAt ?? p.createdAt, settings.timezone, { zone: false })}</span><span className="font-mono text-[11px] text-muted">{p.reference}</span></td>
                    <td><PersonCell name={u.name} email={u.email} src={u.avatarUrl} href={`/admin/users/${u.id}`} /></td>
                    <td className="max-w-[280px] text-body"><span className="line-clamp-2">{p.description}</span></td>
                    <td className="whitespace-nowrap"><span className="block font-display text-[15px] font-bold text-ink">{formatMoney(p.amount, p.currency)}</span><span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted"><span className="flex size-4 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: g.color }}>{g.short}</span>{g.label}</span></td>
                    <td><StatusBadge status={p.status} label={p.status === "paid" ? "Paid" : p.status === "pending" && p.gateway === "manual" ? "Awaiting transfer" : undefined} /></td>
                    <td className="text-right">
                      {p.status === "pending" && (
                        <span className="flex justify-end gap-1.5">
                          {p.gateway === "manual" || p.gateway === "test"
                            ? <ActionButton action={markPaymentPaid.bind(null, p.reference)} variant="primary" pendingText="…">Confirm</ActionButton>
                            : <ActionButton action={recheckPayment.bind(null, p.reference)} pendingText="Checking…">Recheck</ActionButton>}
                          <ActionButton action={markPaymentFailed.bind(null, p.reference)} variant="danger" pendingText="…">Void</ActionButton>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} href={(n) => url({ page: String(n) })} />
          <p className="text-xs text-muted"><BankIcon className="mr-1 inline size-3.5" /> &ldquo;Awaiting transfer&rdquo; means a student chose bank transfer: confirm once the money is in your account. For pending card payments, &ldquo;Recheck&rdquo; asks the gateway again in case a webhook was missed.</p>
        </>
      ) : (
        <EmptyState icon={CardIcon} title="No payments found">{filters.status || filters.gateway || filters.q ? "Try clearing the filters." : "Payments will appear here as students enrol."}</EmptyState>
      )}
    </>
  );
}
