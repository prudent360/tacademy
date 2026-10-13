import type { Metadata } from "next";
import Link from "next/link";
import { and, count, countDistinct, desc, eq, inArray, ne, sum } from "drizzle-orm";
import { AwardIcon, CogIcon, ExternalIcon } from "@/components/icons";
import { Badge, buttonClass, DataTable, EmptyState, Notice, PageHeader, PersonCell, Tabs } from "@/components/ui";
import { getDb } from "@/db";
import { AMBASSADOR_STATUSES, ambassadors, discountCodes, referralCommissions, users, type AmbassadorStatus } from "@/db/schema";
import { AMBASSADOR_STATUS_LABEL, AMBASSADOR_STATUS_TONE, ambassadorConfig, ambassadorRate } from "@/lib/ambassadors";
import { can, requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Ambassadors" };

const TAB_LABEL: Record<AmbassadorStatus, string> = { pending: "Applications", active: "Active", paused: "Paused", declined: "Declined" };

export default async function AdminAmbassadorsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePermission("referrals.manage");
  const { status: raw } = await searchParams;
  const db = await getDb();
  const [config, settingsAccess, counts] = await Promise.all([
    ambassadorConfig(),
    can(user, "settings.manage"),
    db.select({ status: ambassadors.status, n: count() }).from(ambassadors).groupBy(ambassadors.status),
  ]);
  const n = (s: AmbassadorStatus) => counts.find((c) => c.status === s)?.n ?? 0;
  // Open on the review queue when there's something in it, otherwise on the active ambassadors.
  const status = AMBASSADOR_STATUSES.find((s) => s === raw) ?? (n("pending") ? "pending" : "active");

  const rows = await db.select({ a: ambassadors, person: { id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl, gender: users.gender }, code: discountCodes.code })
    .from(ambassadors).innerJoin(users, eq(users.id, ambassadors.userId)).leftJoin(discountCodes, eq(discountCodes.id, ambassadors.discountCodeId))
    .where(eq(ambassadors.status, status)).orderBy(desc(ambassadors.createdAt));
  const ids = rows.map((r) => r.person.id);
  const counted = and(inArray(referralCommissions.referrerId, ids), ne(referralCommissions.status, "cancelled"));
  const [studentRows, moneyRows] = ids.length ? await Promise.all([
    db.select({ referrerId: referralCommissions.referrerId, students: countDistinct(referralCommissions.referredUserId) }).from(referralCommissions).where(counted).groupBy(referralCommissions.referrerId),
    db.select({ referrerId: referralCommissions.referrerId, currency: referralCommissions.currency, total: sum(referralCommissions.amount) }).from(referralCommissions).where(counted).groupBy(referralCommissions.referrerId, referralCommissions.currency),
  ]) : [[], []];
  const students = new Map(studentRows.map((r) => [r.referrerId, r.students]));
  const earned = (id: number) => moneyRows.filter((r) => r.referrerId === id).map((r) => formatMoney(Number(r.total), r.currency)).join(" + ");

  return (
    <>
      <PageHeader
        title="Ambassadors"
        description="People who promote the academy for a higher commission and their own discount code. Their commissions are paid out with the others under Referrals."
        actions={<>
          {config.enabled && <Link href="/ambassadors" target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> Public page</Link>}
          {settingsAccess && <Link href="/admin/settings?tab=payments#ambassadors" className={buttonClass.secondary}><CogIcon className="size-4" /> Programme settings</Link>}
        </>}
      />
      {!config.enabled && <Notice tone="amber">The ambassador programme is closed, so nobody can apply and ambassadors earn the normal Refer &amp; earn rate. Open it under Settings › Payments › Ambassadors.</Notice>}
      <Tabs current={status} items={AMBASSADOR_STATUSES.map((s) => ({ key: s, label: TAB_LABEL[s], count: n(s), href: `/admin/ambassadors?status=${s}` }))} />
      {rows.length ? (
        <DataTable>
          <thead><tr><th>Person</th><th>{status === "pending" ? "Who they reach" : "Commission"}</th>{status !== "pending" && <th>Code</th>}{status !== "pending" && <th>Students</th>}{status !== "pending" && <th>Earned</th>}<th>{status === "pending" ? "Applied" : "Status"}</th></tr></thead>
          <tbody>
            {rows.map(({ a, person, code }) => {
              return (
                <tr key={a.id}>
                  <td><PersonCell name={person.name} email={person.email} src={person.avatarUrl} gender={person.gender} href={`/admin/ambassadors/${a.id}`} /></td>
                  {status === "pending"
                    ? <td className="max-w-[420px] text-muted"><span className="line-clamp-2">{a.audience}</span></td>
                    : <td>{ambassadorRate(a, config)}%{a.percent === null && <span className="text-muted"> (default)</span>}</td>}
                  {status !== "pending" && <td className="font-mono text-sm">{code ?? <span className="font-sans text-muted">None</span>}</td>}
                  {status !== "pending" && <td>{students.get(person.id) ?? 0}</td>}
                  {status !== "pending" && <td className="whitespace-nowrap">{earned(person.id) || "–"}</td>}
                  <td className="whitespace-nowrap">{status === "pending" ? <Link href={`/admin/ambassadors/${a.id}`} className="font-semibold text-accent-ink">Review · {relativeTime(a.createdAt)}</Link> : <Badge tone={AMBASSADOR_STATUS_TONE[a.status]}>{AMBASSADOR_STATUS_LABEL[a.status]}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState icon={AwardIcon} title={status === "pending" ? "No applications waiting" : `No ${TAB_LABEL[status].toLowerCase()} ambassadors`}>{status === "pending" ? "New applications from the Ambassadors page appear here." : "Approve applications to add ambassadors."}</EmptyState>
      )}
    </>
  );
}
