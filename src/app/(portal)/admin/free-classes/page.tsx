import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { CalendarIcon, ExternalIcon, PlayIcon, PlusIcon, TrendIcon, UsersIcon } from "@/components/icons";
import { StatTile } from "@/components/portal/dash";
import { Badge, buttonClass, DataTable, EmptyState, ModeBadge, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { freeClasses, freeClassSignups, payments } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { FREE_CLASS_STATUS_LABEL, FREE_CLASS_STATUS_TONE, seatsLeft } from "@/lib/free-classes";
import { formatSessionRange } from "@/lib/time";

export const metadata: Metadata = { title: "Free classes" };

export default async function AdminFreeClassesPage() {
  await requirePermission("free_classes.manage");
  const db = await getDb();
  const now = new Date();
  const [classes, perClass, settings] = await Promise.all([
    db.select().from(freeClasses).orderBy(desc(freeClasses.startsAt)),
    db.select({ classId: freeClassSignups.classId, n: count() }).from(freeClassSignups).where(isNull(freeClassSignups.cancelledAt)).groupBy(freeClassSignups.classId),
    getSettings(),
  ]);
  // Sign-ups whose personal code was used to pay: the free class turned into an enrolment.
  const [[{ converted }], [{ attended }]] = await Promise.all([
    db.select({ converted: count() }).from(freeClassSignups).innerJoin(payments, eq(payments.discountCodeId, freeClassSignups.discountCodeId)).where(and(isNotNull(freeClassSignups.discountCodeId), eq(payments.status, "paid"))),
    db.select({ attended: count() }).from(freeClassSignups).where(eq(freeClassSignups.attended, true)),
  ]);
  const signups = (id: number) => perClass.find((r) => r.classId === id)?.n ?? 0;
  const upcoming = classes.filter((c) => c.startsAt >= now);
  const past = classes.filter((c) => c.startsAt < now);
  const total = perClass.reduce((a, r) => a + r.n, 0);
  const [{ openUpcoming }] = await db.select({ openUpcoming: count() }).from(freeClasses).where(and(eq(freeClasses.status, "open"), gte(freeClasses.startsAt, now)));

  const rows = (list: typeof classes) => list.map((fc) => {
    const n = signups(fc.id);
    const left = seatsLeft(fc, n);
    return (
      <tr key={fc.id}>
        <td><Link href={`/admin/free-classes/${fc.id}`} className="font-semibold text-ink hover:text-accent-ink">{fc.title}</Link>{fc.hostName && <span className="mt-0.5 block text-xs text-muted">with {fc.hostName}</span>}</td>
        <td className="text-body">{formatSessionRange(fc.startsAt, fc.endsAt, settings.timezone)}</td>
        <td><ModeBadge mode={fc.mode} /></td>
        <td><span className="font-semibold text-ink">{n}</span>{fc.capacity ? <span className="text-muted"> / {fc.capacity}</span> : null}{left === 0 && <Badge tone="amber" className="ml-2">Full</Badge>}</td>
        <td><Badge tone={FREE_CLASS_STATUS_TONE[fc.status]}>{FREE_CLASS_STATUS_LABEL[fc.status]}</Badge>{fc.followUpSentAt && <span className="mt-1 block text-xs text-muted">Follow-up sent</span>}</td>
        <td className="text-right"><Link href={`/admin/free-classes/${fc.id}`} className="inline-flex h-9 items-center rounded-lg border border-edge-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-page">Manage</Link></td>
      </tr>
    );
  });
  const head = <thead><tr><th>Class</th><th>When</th><th>Format</th><th>Sign-ups</th><th>Status</th><th className="text-right"><span className="sr-only">Actions</span></th></tr></thead>;

  return (
    <>
      <PageHeader
        title="Free classes"
        description="Free taster classes and webinars. People sign up without an account, get reminders, and afterwards receive a personal discount code for the course."
        actions={<>
          <Link href="/free-classes" target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View public page</Link>
          <Link href="/admin/free-classes/new" className={buttonClass.primary}><PlusIcon className="size-4" /> New free class</Link>
        </>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Upcoming, open" value={openUpcoming} icon={CalendarIcon} tone="purple" />
        <StatTile label="Sign-ups (all time)" value={total} icon={UsersIcon} tone="cyan" />
        <StatTile label="Attended" value={attended} icon={PlayIcon} tone="navy" hint="As ticked after each class" />
        <StatTile label="Enrolled with their code" value={converted} icon={TrendIcon} tone="green" />
      </div>
      {classes.length ? (
        <>
          {upcoming.length > 0 && <section className="flex flex-col gap-3"><h2 className="font-display text-lg font-bold text-ink">Upcoming</h2><DataTable>{head}<tbody>{rows([...upcoming].reverse())}</tbody></DataTable></section>}
          {past.length > 0 && <section className="flex flex-col gap-3"><h2 className="font-display text-lg font-bold text-ink">Past</h2><DataTable>{head}<tbody>{rows(past)}</tbody></DataTable></section>}
        </>
      ) : (
        <EmptyState icon={CalendarIcon} title="No free classes yet" action={<Link href="/admin/free-classes/new" className={buttonClass.primary}><PlusIcon className="size-4" /> Schedule your first free class</Link>}>A free 60–90 minute class is one of the best ways to turn visitors into students. Sign-ups get reminders, and a discount code afterwards.</EmptyState>
      )}
    </>
  );
}
