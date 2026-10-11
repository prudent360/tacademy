import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { grantCommunityAccess, revokeCommunityMembership } from "@/app/actions/community";
import { ActionButton, ActionForm, Input, Select, SubmitButton } from "@/components/forms";
import { CogIcon, ExternalIcon, UsersIcon } from "@/components/icons";
import { Badge, buttonClass, Card, DataTable, EmptyState, Notice, PageHeader, PersonCell } from "@/components/ui";
import { getDb } from "@/db";
import { communityMemberships, payments, users } from "@/db/schema";
import { can, requirePermission } from "@/lib/auth";
import { communityConfig, isPaidCommunity } from "@/lib/community-access";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Community members" };

const formatDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminCommunityPage() {
  const user = await requirePermission("community.manage");
  const db = await getDb();
  const [config, settingsAccess, rows] = await Promise.all([
    communityConfig(),
    can(user, "settings.manage"),
    db.select({ membership: communityMemberships, member: { id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl, gender: users.gender }, payment: { reference: payments.reference, amount: payments.amount, currency: payments.currency } })
      .from(communityMemberships).innerJoin(users, eq(users.id, communityMemberships.userId)).leftJoin(payments, eq(payments.id, communityMemberships.paymentId))
      .orderBy(desc(communityMemberships.endsAt)).limit(500),
  ]);
  const now = new Date();
  const paid = isPaidCommunity(config);

  return (
    <>
      <PageHeader
        title="Community members"
        description="People with paid or granted membership. Current students, graduates, instructors and the team get in free and aren't listed here."
        actions={
          <>
            <Link href="/community" className={buttonClass.secondary}><ExternalIcon className="size-4" /> Open community</Link>
            {settingsAccess && <Link href="/admin/settings?tab=payments#community" className={buttonClass.secondary}><CogIcon className="size-4" /> Price & settings</Link>}
          </>
        }
      />
      {!paid && <Notice tone="amber">The community is currently free for every account. Turn on paid membership under Settings › Payments › Community.</Notice>}
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        {rows.length ? (
          <DataTable>
            <thead><tr><th>Member</th><th>Period</th><th>How</th><th>Status</th><th className="text-right"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map(({ membership: m, member, payment }) => {
                const status = m.revokedAt ? { label: "Ended early", tone: "red" as const } : m.endsAt <= now ? { label: "Expired", tone: "neutral" as const } : m.startsAt > now ? { label: "Starts later", tone: "accent" as const } : { label: "Active", tone: "green" as const };
                return (
                  <tr key={m.id}>
                    <td><PersonCell name={member.name} email={member.email} src={member.avatarUrl} gender={member.gender} href={`/admin/users/${member.id}`} /></td>
                    <td className="whitespace-nowrap text-muted">{formatDate(m.startsAt)} – {formatDate(m.endsAt)}</td>
                    <td className="whitespace-nowrap">{payment ? <Link href={`/admin/payments?q=${payment.reference}`} className="text-accent-ink hover:underline">{formatMoney(payment.amount, payment.currency)}</Link> : <span className="text-muted">Given by the team</span>}</td>
                    <td><Badge tone={status.tone}>{status.label}</Badge></td>
                    <td className="text-right">{!m.revokedAt && m.endsAt > now && <ActionButton action={revokeCommunityMembership.bind(null, m.id)} variant="danger" pendingText="Ending…">End now</ActionButton>}</td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <EmptyState icon={UsersIcon} title="No paid members yet">When someone pays for membership, or you give it to them, they appear here.</EmptyState>
        )}
        <Card title="Give membership">
          <ActionForm action={grantCommunityAccess} resetOnSuccess className="flex flex-col gap-4">
            <Input label="Email address" name="email" type="email" required placeholder="name@example.com" hint="They need an account already." />
            <Select label="For" name="months" defaultValue={String(config.months)} options={[...new Set([1, 3, 6, 12, 24, config.months])].sort((a, b) => a - b).map((n) => ({ value: String(n), label: n === 1 ? "1 month" : `${n} months` }))} />
            <SubmitButton pendingText="Adding…">Give membership</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
