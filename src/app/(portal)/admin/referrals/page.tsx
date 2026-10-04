import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, gt, isNotNull, lte, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cancelCommission, markCommissionsPaid } from "@/app/actions/referrals";
import { ActionButton, ActionForm, Input, ModalButton, SubmitButton } from "@/components/forms";
import { CheckCircleIcon, ClockIcon, GiftIcon, UsersIcon } from "@/components/icons";
import { StatTile } from "@/components/portal/dash";
import { Badge, Card, DataTable, EmptyState, Notice, PageHeader, Pagination } from "@/components/ui";
import { getDb } from "@/db";
import { referralCommissions, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { commissionState, referralConfig, type CommissionState } from "@/lib/referrals";
import { relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Referrals" };

const PAGE_SIZE = 50;
const STATE: Record<CommissionState, { label: string; tone: "amber" | "green" | "accent" | "neutral" }> = {
  pending: { label: "Waiting", tone: "amber" },
  ready: { label: "Ready to pay", tone: "accent" },
  paid: { label: "Paid", tone: "green" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

function money(totals: Map<string, number>): string {
  const parts = [...totals].filter(([, v]) => v > 0).map(([c, v]) => formatMoney(v, c));
  return parts.length ? parts.join(" + ") : "0";
}

export default async function AdminReferralsPage({ searchParams }: { searchParams: Promise<{ state?: string; page?: string; done?: string }> }) {
  await requirePermission("referrals.manage");
  const params = await searchParams;
  const state = (["pending", "ready", "paid", "cancelled"] as const).find((s) => s === params.state);
  const page = Math.max(1, Number(params.page) || 1);
  const now = new Date();
  const db = await getDb();
  const referrer = alias(users, "referrer");
  const referred = alias(users, "referred");

  const filter: SQL | undefined =
    state === "pending" ? and(eq(referralCommissions.status, "pending"), gt(referralCommissions.availableAt, now))
    : state === "ready" ? and(eq(referralCommissions.status, "pending"), lte(referralCommissions.availableAt, now))
    : state ? eq(referralCommissions.status, state)
    : undefined;

  const [cfg, all, rows, [{ total }], [{ signups }]] = await Promise.all([
    referralConfig(),
    db.select({ c: referralCommissions, referrer: { id: referrer.id, name: referrer.name, email: referrer.email, payoutDetails: referrer.payoutDetails } })
      .from(referralCommissions).innerJoin(referrer, eq(referrer.id, referralCommissions.referrerId)),
    db.select({ c: referralCommissions, referrer: { id: referrer.id, name: referrer.name }, referred: { id: referred.id, name: referred.name } })
      .from(referralCommissions).innerJoin(referrer, eq(referrer.id, referralCommissions.referrerId)).leftJoin(referred, eq(referred.id, referralCommissions.referredUserId))
      .where(filter).orderBy(desc(referralCommissions.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(referralCommissions).where(filter),
    db.select({ signups: count() }).from(users).where(isNotNull(users.referredById)),
  ]);

  const totals: Record<CommissionState, Map<string, number>> = { pending: new Map(), ready: new Map(), paid: new Map(), cancelled: new Map() };
  // What's payable now, one line per person and currency.
  const payable = new Map<string, { referrer: (typeof all)[number]["referrer"]; currency: string; amount: number; count: number }>();
  for (const { c, referrer: r } of all) {
    const s = commissionState(c, now);
    totals[s].set(c.currency, (totals[s].get(c.currency) ?? 0) + c.amount);
    if (s === "ready") {
      const key = `${r.id}:${c.currency}`;
      const line = payable.get(key) ?? { referrer: r, currency: c.currency, amount: 0, count: 0 };
      line.amount += c.amount;
      line.count++;
      payable.set(key, line);
    }
  }
  const url = (next: { state?: string; page?: number }) => {
    const qs = new URLSearchParams(Object.entries({ state, ...next }).filter(([, v]) => v !== undefined && v !== 1).map(([k, v]) => [k, String(v)])).toString();
    return qs ? `/admin/referrals?${qs}` : "/admin/referrals";
  };

  return (
    <>
      <PageHeader
        title="Referrals"
        description={cfg.enabled ? `People earn ${cfg.percent}% (or the course's own rate) when someone they refer pays. Commission is payable ${cfg.holdDays ? `${cfg.holdDays} days after the payment` : "as soon as they pay"}.` : "Refer & earn is switched off."}
        actions={<Link href="/admin/settings?tab=referrals" className="inline-flex h-11 items-center rounded-[5px] border border-edge-strong bg-surface px-5 text-[15px] font-semibold text-ink hover:bg-page">Referral settings</Link>}
      />
      {params.done && <Notice tone="green">{params.done.slice(0, 200)}</Notice>}
      {!cfg.enabled && <Notice tone="amber">Referrals are off, so no new commission is earned. <Link href="/admin/settings?tab=referrals" className="font-semibold underline">Switch them on in Settings › Referrals</Link>.</Notice>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Ready to pay" value={money(totals.ready)} icon={GiftIcon} tone="purple" href={url({ state: "ready" })} />
        <StatTile label="Waiting" value={money(totals.pending)} icon={ClockIcon} tone="navy" hint="Inside the refund window" href={url({ state: "pending" })} />
        <StatTile label="Paid out" value={money(totals.paid)} icon={CheckCircleIcon} tone="green" href={url({ state: "paid" })} />
        <StatTile label="Referred sign-ups" value={signups.toLocaleString()} icon={UsersIcon} tone="cyan" />
      </div>

      <Card title="Ready to pay" padded={false}>
        {payable.size ? (
          <ul className="divide-y divide-line">
            {[...payable.values()].sort((a, b) => b.amount - a.amount).map(({ referrer: r, currency, amount, count: n }) => {
              const d = r.payoutDetails;
              return (
                <li key={`${r.id}:${currency}`} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 md:px-6">
                  <div className="min-w-[200px] grow">
                    <Link href={`/admin/users/${r.id}`} className="font-semibold text-ink hover:text-accent-ink">{r.name}</Link>
                    <p className="text-sm text-muted">{r.email} · {n} commission{n === 1 ? "" : "s"}</p>
                  </div>
                  <div className="min-w-[220px] text-sm">
                    {d ? (d.method === "bank" ? <p className="text-body"><strong className="text-ink">{d.bankName}</strong> · {d.accountNumber}<br /><span className="text-muted">{d.accountName}</span></p> : <p className="whitespace-pre-line text-body">{d.other}</p>) : <Badge tone="amber">No payout details yet</Badge>}
                  </div>
                  <p className="font-display text-xl font-bold text-ink">{formatMoney(amount, currency)}</p>
                  <ModalButton label="Mark as paid" title={`Pay ${r.name} ${formatMoney(amount, currency)}`}>
                    <ActionForm action={markCommissionsPaid.bind(null, r.id, currency)}>
                      <p className="text-sm text-body">Send <strong>{formatMoney(amount, currency)}</strong> to {r.name} first, then record it here. They&apos;ll get an email saying it&apos;s been paid.</p>
                      <Input label="Payment note (optional)" name="note" placeholder="e.g. Bank transfer, ref 0042" hint="Included in their email." />
                      <SubmitButton pendingText="Saving…">Mark {formatMoney(amount, currency)} as paid</SubmitButton>
                    </ActionForm>
                  </ModalButton>
                </li>
              );
            })}
          </ul>
        ) : <p className="p-6 text-muted">Nothing to pay right now. Commissions appear here once their waiting period ends.</p>}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[17px] font-bold text-ink">All commissions</h2>
        <nav aria-label="Filter commissions" className="flex flex-wrap gap-1.5">
          {([[undefined, "All"], ["pending", "Waiting"], ["ready", "Ready to pay"], ["paid", "Paid"], ["cancelled", "Cancelled"]] as const).map(([key, label]) => (
            <Link key={label} href={url({ state: key })} aria-current={state === key ? "true" : undefined} className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${state === key ? "bg-accent text-white" : "bg-surface text-muted ring-1 ring-edge hover:text-ink"}`}>{label}</Link>
          ))}
        </nav>
        {rows.length ? (
          <>
            <DataTable>
              <thead><tr><th>When</th><th>Referrer</th><th>Referred</th><th>Course</th><th>They paid</th><th>Commission</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.map(({ c, referrer: r, referred: p }) => {
                  const s = commissionState(c, now);
                  return (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap text-muted">{relativeTime(c.createdAt)}</td>
                      <td><Link href={`/admin/users/${r.id}`} className="font-semibold text-ink hover:text-accent-ink">{r.name}</Link></td>
                      <td>{p ? <Link href={`/admin/users/${p.id}`} className="text-body hover:text-accent-ink">{p.name}</Link> : <span className="text-muted">Deleted account</span>}</td>
                      <td className="text-body">{c.courseTitle}</td>
                      <td className="whitespace-nowrap text-body">{formatMoney(c.paymentAmount, c.currency)}</td>
                      <td className="whitespace-nowrap"><span className="font-semibold text-ink">{formatMoney(c.amount, c.currency)}</span> <span className="text-xs text-muted">({c.percent}%)</span></td>
                      <td>
                        <Badge tone={STATE[s].tone}>{STATE[s].label}</Badge>
                        {s === "pending" && <p className="mt-1 text-xs text-muted">Payable {relativeTime(c.availableAt)}</p>}
                        {c.note && <p className="mt-1 max-w-[220px] text-xs text-muted">{c.note}</p>}
                      </td>
                      <td className="text-right">{(s === "pending" || s === "ready") && <ActionButton action={cancelCommission.bind(null, c.id)} variant="danger" pendingText="…">Cancel</ActionButton>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
            <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} href={(n) => url({ page: n })} />
          </>
        ) : <EmptyState icon={GiftIcon} title="No commissions yet">When someone joins through a referral link and pays, the commission shows here.</EmptyState>}
      </section>
    </>
  );
}
