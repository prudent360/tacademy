import type { Metadata } from "next";
import Link from "next/link";
import { and, countDistinct, eq, ne, sum } from "drizzle-orm";
import { notFound } from "next/navigation";
import { approveAmbassador, declineAmbassador, setAmbassadorPaused, updateAmbassador } from "@/app/actions/ambassadors";
import { ActionButton, ActionForm, Input, SubmitButton, Textarea } from "@/components/forms";
import { Badge, Card, Notice, PageHeader, PersonCell } from "@/components/ui";
import { getDb } from "@/db";
import { ambassadors, discountCodes, referralCommissions, users } from "@/db/schema";
import { AMBASSADOR_STATUS_LABEL, AMBASSADOR_STATUS_TONE, ambassadorConfig, ambassadorRate } from "@/lib/ambassadors";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { relativeTime } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Ambassador" };

/** A memorable code from their first name and the discount, e.g. ADA10, made unique if it's taken. */
async function suggestCode(name: string, percent: number): Promise<string> {
  const stem = (name.split(" ")[0] ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10) || "FRIEND";
  const db = await getDb();
  for (const candidate of [`${stem}${percent}`, ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${stem}${percent}${n}`)]) {
    const [taken] = await db.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.code, candidate));
    if (!taken) return candidate;
  }
  return `${stem}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="whitespace-pre-line break-words text-[15px] text-body">{children}</dd></div>;
}

export default async function AdminAmbassadorPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("referrals.manage");
  const id = idParam((await params).id);
  if (!id) notFound();
  const db = await getDb();
  const [found] = await db.select({ a: ambassadors, person: users, code: discountCodes }).from(ambassadors).innerJoin(users, eq(users.id, ambassadors.userId)).leftJoin(discountCodes, eq(discountCodes.id, ambassadors.discountCodeId)).where(eq(ambassadors.id, id));
  if (!found) notFound();
  const { a, person, code } = found;
  const config = await ambassadorConfig();
  const counted = and(eq(referralCommissions.referrerId, person.id), ne(referralCommissions.status, "cancelled"));
  const [[{ students }], totals] = await Promise.all([
    db.select({ students: countDistinct(referralCommissions.referredUserId) }).from(referralCommissions).where(counted),
    db.select({ currency: referralCommissions.currency, total: sum(referralCommissions.amount) }).from(referralCommissions).where(counted).groupBy(referralCommissions.currency),
  ]);
  const deciding = a.status === "pending" || a.status === "declined";
  const suggestion = deciding ? code?.code ?? (await suggestCode(person.name, config.discountPercent)) : "";

  return (
    <>
      <PageHeader
        back={{ href: `/admin/ambassadors?status=${a.status}`, label: "Ambassadors" }}
        title={person.name}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={AMBASSADOR_STATUS_TONE[a.status]}>{AMBASSADOR_STATUS_LABEL[a.status]}</Badge>Applied {relativeTime(a.createdAt)}{a.decidedAt && ` · decided ${relativeTime(a.decidedAt)}`}</span>}
        actions={a.status === "active" ? <ActionButton action={setAmbassadorPaused.bind(null, id, true)} variant="danger" pendingText="Pausing…">Pause</ActionButton> : a.status === "paused" ? <ActionButton action={setAmbassadorPaused.bind(null, id, false)} pendingText="Resuming…">Resume</ActionButton> : undefined}
      />
      {a.status === "paused" && <Notice tone="amber">Paused: their discount code is off and new sales earn the normal Refer &amp; earn rate.</Notice>}
      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Application">
          <dl className="flex flex-col gap-5">
            <Field label="Applicant"><PersonCell name={person.name} email={person.email} src={person.avatarUrl} gender={person.gender} href={`/admin/users/${person.id}`} /></Field>
            {person.phone && <Field label="Phone">{person.phone}</Field>}
            <Field label="Who they reach">{a.audience}</Field>
            <Field label="Where they'll share">{a.channels.split("\n").map((line, i) => /^https?:\/\/\S+$/.test(line.trim()) ? <a key={i} href={line.trim()} target="_blank" rel="noopener noreferrer" className="block text-accent-ink hover:underline">{line.trim()}</a> : <span key={i} className="block">{line}</span>)}</Field>
            <Field label="Why they want to join">{a.motivation}</Field>
            {!deciding && <Field label="Results">{students} paying {students === 1 ? "student" : "students"}{totals.length ? ` · ${totals.map((t) => formatMoney(Number(t.total), t.currency)).join(" + ")} earned` : ""} · <Link href="/admin/referrals" className="text-accent-ink hover:underline">payouts</Link></Field>}
          </dl>
        </Card>

        {deciding ? (
          <Card title="Approve">
            <ActionForm action={approveAmbassador.bind(null, id)} className="flex flex-col gap-4">
              <Input label="Commission (%)" name="percent" type="number" min={1} max={90} placeholder={`${config.percent} (default)`} hint={`Leave empty for the programme default, ${config.percent}%. Paid on every course their students buy.`} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Discount code" name="code" defaultValue={suggestion} hint="What their audience types at checkout." className="[&_input]:font-mono [&_input]:uppercase" />
                <Input label="Discount (%)" name="discountPercent" type="number" min={0} max={90} defaultValue={code?.percentOff ?? config.discountPercent} hint="0 for no code." />
              </div>
              <SubmitButton pendingText="Approving…">Approve and email them</SubmitButton>
            </ActionForm>
            {a.status === "pending" && (
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-5">
                <p className="text-sm text-muted">Not a fit? They&apos;ll get a polite email and can still use Refer &amp; earn.</p>
                <ActionButton action={declineAmbassador.bind(null, id)} variant="danger" pendingText="Declining…">Decline</ActionButton>
              </div>
            )}
          </Card>
        ) : (
          <Card title="Terms">
            <ActionForm action={updateAmbassador.bind(null, id)} className="flex flex-col gap-4">
              <Input label="Commission (%)" name="percent" type="number" min={1} max={90} defaultValue={a.percent ?? ""} placeholder={`${config.percent} (default)`} hint={`Currently ${ambassadorRate(a, config)}%. Changes apply to new sales only.`} />
              {code ? (
                <Input label={`Discount for ${code.code} (%)`} name="discountPercent" type="number" min={0} max={90} defaultValue={code.active ? code.percentOff : 0} hint="0 switches their code off." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="New discount code" name="code" placeholder={`e.g. ${(person.name.split(" ")[0] ?? "").toUpperCase().replace(/[^A-Z]/g, "")}${config.discountPercent || 10}`} hint="Optional. They don't have one yet." className="[&_input]:font-mono [&_input]:uppercase" />
                  <Input label="Discount (%)" name="discountPercent" type="number" min={0} max={90} defaultValue={0} />
                </div>
              )}
              <Textarea label="Private notes" name="adminNotes" defaultValue={a.adminNotes} rows={3} hint="Only the team sees these." />
              <SubmitButton>Save</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
