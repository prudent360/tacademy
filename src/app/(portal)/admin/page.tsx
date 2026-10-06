import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import {
  AlertIcon, BookIcon, CalendarIcon, CardIcon, ChartIcon, CheckIcon, LayersIcon, MailIcon, PlusIcon, ShieldIcon, TrendIcon, UsersIcon,
} from "@/components/icons";
import { BannerButton, BarChart, GreetingBanner, Panel, PanelEmpty, ProgressBar, QuickAction, StatTile } from "@/components/portal/dash";
import { Avatar, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { classSessions, enrollments, payments, users } from "@/db/schema";
import { permissionsFor, requirePermission } from "@/lib/auth";
import { getSettings, getUpcomingCohorts, seatsTaken } from "@/lib/data";
import { emailConfigured } from "@/lib/email";
import { formatMoney } from "@/lib/money";
import { gatewayConfigured } from "@/lib/payments";
import { blobConfigured } from "@/lib/storage";
import { formatDateOnly, greeting, hoursAgo, relativeTime, thisWeek } from "@/lib/time";
import { firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

/** The last `n` calendar months as { key: "2026-09", label: "Sep" }, oldest first. */
function lastMonths(n: number, now: Date) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) };
  });
}

const compact = (minor: number, currency: string) => {
  const major = minor / 100;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "narrowSymbol", notation: major >= 10000 ? "compact" : "standard", maximumFractionDigits: major >= 10000 ? 1 : 0 }).format(major);
};

export default async function AdminHome() {
  const admin = await requirePermission("admin.access");
  const db = await getDb();
  const settings = await getSettings();
  const now = new Date();
  const months = lastMonths(6, now);
  const sixMonthsAgo = new Date(`${months[0].key}-01T00:00:00Z`);
  const thirtyDaysAgo = hoursAgo(30 * 24);
  const week = thisWeek(now);
  const primary = settings.currencies[0] ?? "GBP";

  const [[students], [newStudents], [active], [pending], paid, recentPayments, recentUsers, upcoming, [weekSessions], recentEnrollments] = await Promise.all([
    db.select({ n: count() }).from(users).where(eq(users.role, "student")),
    db.select({ n: count() }).from(users).where(and(eq(users.role, "student"), gte(users.createdAt, thirtyDaysAgo))),
    db.select({ n: count() }).from(enrollments).where(eq(enrollments.status, "active")),
    db.select({ n: count() }).from(payments).where(and(eq(payments.status, "pending"), gte(payments.createdAt, hoursAgo(72)))),
    db.select({ amount: sql<number>`${payments.amount} - ${payments.refundedAmount}`.mapWith(Number), currency: payments.currency, paidAt: payments.paidAt }).from(payments).where(and(eq(payments.status, "paid"), gte(payments.paidAt, sixMonthsAgo))),
    db.select({ payment: payments, name: users.name }).from(payments).innerJoin(users, eq(users.id, payments.userId)).where(inArray(payments.status, ["paid", "failed"])).orderBy(desc(payments.createdAt)).limit(5),
    db.select().from(users).where(eq(users.role, "student")).orderBy(desc(users.createdAt)).limit(5),
    getUpcomingCohorts(5),
    db.select({ n: count() }).from(classSessions).where(and(eq(classSessions.cancelled, false), gte(classSessions.startsAt, week.start), lt(classSessions.startsAt, week.end))),
    db.select({ createdAt: enrollments.createdAt }).from(enrollments).where(and(inArray(enrollments.status, ["active", "completed"]), gte(enrollments.createdAt, sixMonthsAgo))),
  ]);
  const taken = await seatsTaken(upcoming.map((u) => u.cohort.id));

  const revenue30 = new Map<string, number>();
  for (const p of paid) if (p.paidAt && p.paidAt >= thirtyDaysAgo) revenue30.set(p.currency, (revenue30.get(p.currency) ?? 0) + p.amount);
  const primary30 = revenue30.get(primary) ?? 0;
  const others30 = [...revenue30.entries()].filter(([c]) => c !== primary);
  const revenueSeries = months.map((m) => ({ label: m.label, value: paid.filter((p) => p.currency === primary && p.paidAt?.toISOString().startsWith(m.key)).reduce((a, p) => a + p.amount, 0) }));
  const enrolSeries = months.map((m) => ({ label: m.label, value: recentEnrollments.filter((e) => e.createdAt.toISOString().startsWith(m.key)).length }));
  const otherCurrencyTotals = [...new Set(paid.map((p) => p.currency))].filter((c) => c !== primary).map((c) => ({ c, total: paid.filter((p) => p.currency === c).reduce((a, p) => a + p.amount, 0) }));

  const [stripeOk, paystackOk, emailOk] = await Promise.all([gatewayConfigured("stripe"), gatewayConfigured("paystack"), emailConfigured()]);
  const setup = [
    { ok: stripeOk, label: "Stripe payments", hint: "Add your keys in Settings → Payments", href: "/admin/settings?tab=payments" },
    { ok: paystackOk, label: "Paystack payments", hint: "Add your keys in Settings → Payments", href: "/admin/settings?tab=payments" },
    { ok: emailOk, label: "Email delivery", hint: "Set up Resend or SMTP in Settings → Email", href: "/admin/settings?tab=messages#email" },
    { ok: Boolean(process.env.CRON_SECRET), label: "Class reminders", hint: "Set CRON_SECRET in Vercel", href: "/admin/settings?tab=messages#reminders" },
    { ok: blobConfigured() || !process.env.VERCEL, label: "File uploads", hint: "Connect a Vercel Blob store", href: undefined },
  ];
  const setupDone = setup.filter((s) => s.ok).length;

  // Each section shows only to people whose role covers it (administrators see everything).
  const perms = await permissionsFor(admin);
  const money = perms.has("payments.view");
  const people = perms.has("users.view");
  const courseAdmin = perms.has("courses.manage");

  return (
    <>
      <GreetingBanner
        tone="admin"
        title={`${greeting(settings.timezone, now)}, ${firstName(admin.name)}`}
        subtitle={`Here's how ${settings.siteName} is doing.`}
        aside={money && people && (
          <div className="grid grid-cols-2 gap-6 rounded-2xl border border-white/15 bg-white/[0.07] px-6 py-4 backdrop-blur">
            <div><p className="font-display text-2xl font-bold">{compact(primary30, primary)}</p><p className="text-xs font-semibold uppercase tracking-wider text-white/60">Revenue, 30 days</p></div>
            <div><p className="font-display text-2xl font-bold">{newStudents.n}</p><p className="text-xs font-semibold uppercase tracking-wider text-white/60">New students</p></div>
          </div>
        )}
      >
        {courseAdmin && <BannerButton href="/admin/courses/new"><PlusIcon className="size-4" /> New course</BannerButton>}
        {money && <BannerButton href="/admin/payments" variant="ghost"><CardIcon className="size-4" /> Payments</BannerButton>}
      </GreetingBanner>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {people && <StatTile label="Students" value={students.n} icon={UsersIcon} tone="purple" hint={`+${newStudents.n} in the last 30 days`} href="/admin/users?role=student" />}
        <StatTile label="Active enrolments" value={active.n} icon={LayersIcon} tone="cyan" href="/admin/courses" />
        {money && <StatTile label={`Revenue (30 days, ${primary})`} value={formatMoney(primary30, primary)} icon={TrendIcon} tone="green" hint={others30.length ? `+ ${others30.map(([c, v]) => formatMoney(v, c)).join(" · ")}` : undefined} href="/admin/payments?status=paid" />}
        <StatTile label="Classes this week" value={weekSessions.n} icon={CalendarIcon} tone="navy" hint={pending.n ? `${pending.n} checkouts pending` : undefined} href="/teach/schedule" />
      </div>

      {setupDone < setup.length && perms.has("settings.manage") && (
        <Panel title="Finish setting up" icon={AlertIcon}>
          <div className="grid gap-5 xl:grid-cols-[220px_1fr] xl:items-center">
            <ProgressBar value={setupDone} max={setup.length} tone="cyan" label="Academy setup" detail={`${setupDone} of ${setup.length} complete`} />
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {setup.map((s) => (
                <li key={s.label} className={`flex items-start gap-3 border p-3 text-sm ${s.ok ? "border-emerald-100 bg-emerald-50/60" : "border-edge bg-panel"} rounded-[5px]`}>
                  <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${s.ok ? "bg-emerald-100 text-emerald-700" : "border-2 border-edge-strong bg-surface"}`}>{s.ok && <CheckIcon className="size-3.5" />}</span>
                  <span className="flex min-w-0 flex-col"><span className={`font-semibold ${s.ok ? "text-emerald-800" : "text-ink"}`}>{s.label}</span>{s.ok ? <span className="text-xs text-emerald-700">Connected</span> : s.href ? <Link href={s.href} className="text-xs font-medium text-accent-ink hover:text-accent-ink-strong">{s.hint} →</Link> : <span className="text-xs text-muted">{s.hint}</span>}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {money && <Panel title={`Revenue in ${primary}`} icon={ChartIcon} href="/admin/payments?status=paid">
          <BarChart data={revenueSeries} format={(v) => compact(v, primary)} />
          {otherCurrencyTotals.length > 0 && (
            <p className="mt-4 border-t border-line pt-3 text-sm text-muted">Other currencies, last 6 months: {otherCurrencyTotals.map((o) => <span key={o.c} className="ml-2 font-semibold text-ink">{formatMoney(o.total, o.c)}</span>)}</p>
          )}
        </Panel>}
        <Panel title="Enrolments per month" icon={UsersIcon}>
          <BarChart data={enrolSeries} tone="cyan" />
        </Panel>
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Panel title="Upcoming cohorts" href="/admin/courses" linkLabel="Manage" icon={BookIcon}>
          {upcoming.length ? (
            <ul className="flex flex-col gap-4">
              {upcoming.map(({ cohort, course }) => {
                const seats = taken.get(cohort.id) ?? 0;
                return (
                  <li key={cohort.id}>
                    <Link href={`/teach/cohorts/${cohort.id}`} className="flex flex-col gap-2 rounded-[5px] border border-edge p-4 transition hover:-translate-y-0.5 hover:border-accent-muted hover:bg-panel">
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 flex-col"><span className="truncate font-semibold text-ink">{course.title}</span><span className="text-sm text-muted">{cohort.name} · starts {formatDateOnly(cohort.startDate) || "TBC"}</span></span>
                        {!cohort.enrollmentOpen && <StatusBadge status="pending" label="Closed" />}
                      </span>
                      <ProgressBar value={seats} max={cohort.capacity ?? Math.max(seats, 1)} tone={cohort.capacity && seats >= cohort.capacity ? "amber" : "purple"} label="Seats filled" detail={cohort.capacity ? `${seats}/${cohort.capacity}` : `${seats} enrolled`} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <PanelEmpty icon={BookIcon} action={<Link href="/admin/courses" className="text-sm font-semibold text-accent-ink">Add a cohort →</Link>}>No upcoming cohorts.</PanelEmpty>}
        </Panel>

        {money && <Panel title="Recent payments" href="/admin/payments" icon={CardIcon}>
            {recentPayments.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {recentPayments.map(({ payment, name }) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <span className="flex min-w-0 flex-col"><span className="truncate font-semibold text-ink">{name}</span><span className="truncate text-xs text-muted">{payment.description}</span></span>
                    <span className="flex shrink-0 flex-col items-end gap-1"><span className="font-semibold text-ink">{formatMoney(payment.amount, payment.currency)}</span><StatusBadge status={payment.status} /></span>
                  </li>
                ))}
              </ul>
            ) : <PanelEmpty icon={CardIcon}>No payments yet.</PanelEmpty>}
        </Panel>}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {people && <Panel title="Newest students" href="/admin/users?role=student" icon={UsersIcon}>
          {recentUsers.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {recentUsers.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 py-3 first:pt-0">
                    <Avatar name={u.name} src={u.avatarUrl} gender={u.gender} size="sm" />
                    <span className="flex min-w-0 grow flex-col"><span className="truncate font-semibold text-ink">{u.name}</span><span className="truncate text-xs text-muted">{u.email}</span></span>
                    <span className="shrink-0 text-xs text-muted">{relativeTime(u.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <PanelEmpty icon={UsersIcon}>No students yet.</PanelEmpty>}
        </Panel>}
        <Panel title="Quick actions">
          <div className="grid gap-3">
            {courseAdmin && <QuickAction href="/admin/courses/new" icon={BookIcon} title="Create a course" text="Then add cohorts, prices and classes" tone="purple" />}
            {perms.has("users.manage") && <QuickAction href="/admin/users" icon={UsersIcon} title="Invite an instructor" text="They set their own password" tone="cyan" />}
            {perms.has("payments.manage") && <QuickAction href="/admin/payments" icon={CardIcon} title="Record an offline payment" text="Bank transfer or cash, enrols the student" tone="green" />}
            {perms.has("emails.manage") && <QuickAction href="/admin/settings?tab=templates" icon={MailIcon} title="Edit email templates" text="Reminders, receipts, feedback and more" tone="navy" />}
            {perms.has("team.manage") && <QuickAction href="/admin/team" icon={ShieldIcon} title="Manage your team" text="Roles and what each can do" tone="purple" />}
          </div>
        </Panel>
      </div>
    </>
  );
}
