import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { applyAsAmbassador } from "@/app/actions/ambassadors";
import { savePayoutDetails } from "@/app/actions/referrals";
import { ActionForm, Checkbox, Input, SubmitButton, Textarea } from "@/components/forms";
import { AwardIcon, CardIcon, ClockIcon, GiftIcon, LinkIcon, TrendIcon, UsersIcon } from "@/components/icons";
import { StatTile } from "@/components/portal/dash";
import { CopyLinkButton, PayoutMethod, ReferralShare } from "@/components/portal/referral-share";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { discountCodes, referralCommissions, users } from "@/db/schema";
import { ambassadorConfig, ambassadorFor, ambassadorLeaderboard, ambassadorRate, startOfMonth } from "@/lib/ambassadors";
import { requireUser } from "@/lib/auth";
import { fromPrice, withCohorts } from "@/lib/catalog";
import { currencyForCountry } from "@/lib/countries";
import { getPublishedCourses, getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { commissionState, ensureReferralCode, referralConfig, referralLink, type CommissionState } from "@/lib/referrals";
import { relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Ambassador" };

const STATE: Record<CommissionState, { label: string; tone: "amber" | "green" | "accent" | "neutral" }> = {
  pending: { label: "Waiting", tone: "amber" },
  ready: { label: "Ready to pay", tone: "accent" },
  paid: { label: "Paid", tone: "green" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** Totals per currency, e.g. "₦50,000 + £40". */
function money(totals: Map<string, number>): string {
  const parts = [...totals].filter(([, v]) => v > 0).map(([c, v]) => formatMoney(v, c));
  return parts.length ? parts.join(" + ") : "0";
}

function add(totals: Map<string, number>, currency: string, amount: number) {
  totals.set(currency, (totals.get(currency) ?? 0) + amount);
}

export default async function AmbassadorPage({ searchParams }: { searchParams: Promise<{ applied?: string }> }) {
  const [{ applied }, user, config, settings, referrals] = await Promise.all([searchParams, requireUser(), ambassadorConfig(), getSettings(), referralConfig()]);
  const record = await ambassadorFor(user.id);

  if (!record || record.status === "declined") {
    if (!config.enabled) {
      return <>
        <PageHeader title="Ambassador programme" />
        <EmptyState icon={AwardIcon} title="Applications aren't open right now">Check back soon. Meanwhile, you can still earn with Refer &amp; earn.</EmptyState>
      </>;
    }
    return (
      <>
        <PageHeader title="Become an ambassador" description={`Earn ${config.percent}% of what every student you bring pays, on every course they take.${config.discountPercent ? ` Your audience gets ${config.discountPercent}% off with your own code.` : ""}`} back={{ href: "/ambassadors", label: "About the programme" }} />
        {record && <Notice tone="amber">Your last application wasn&apos;t successful. You&apos;re welcome to apply again with more detail about who you reach.</Notice>}
        <Card title="Your application" className="max-w-3xl">
          <ActionForm action={applyAsAmbassador}>
            <Textarea label="Who do you reach?" name="audience" required rows={3} maxLength={1000} defaultValue={record?.audience} placeholder="e.g. Final-year students at my university, and about 4,000 people who follow my data tips on LinkedIn." />
            <Textarea label="Where will you share?" name="channels" required rows={3} maxLength={1000} defaultValue={record?.channels} hint="Links to your profiles, groups or channels, one per line." placeholder={"https://linkedin.com/in/…\nWhatsApp group: Data careers Lagos (600 members)"} />
            <Textarea label="Why would you like to be an ambassador?" name="motivation" required rows={4} maxLength={2000} defaultValue={record?.motivation} />
            <Checkbox label="I'll promote the academy honestly: no spam, fake reviews, or paid ads that bid on the academy's name." name="terms" />
            <SubmitButton pendingText="Sending…">Send application</SubmitButton>
          </ActionForm>
        </Card>
      </>
    );
  }

  if (record.status === "pending") {
    return (
      <>
        <PageHeader title="Ambassador programme" />
        {applied && <Notice>Application sent. We&apos;ve emailed you a confirmation.</Notice>}
        <EmptyState icon={ClockIcon} title="We're reviewing your application">
          You applied {relativeTime(record.createdAt)}. We&apos;ll email you as soon as we&apos;ve decided, usually within a few working days.
        </EmptyState>
      </>
    );
  }

  // Active or paused: the dashboard.
  const code = await ensureReferralCode(user);
  const db = await getDb();
  const monthStart = startOfMonth();
  const [commissions, [{ signups }], [{ signupsThisMonth }], [discount], courses, board] = await Promise.all([
    db.select().from(referralCommissions).where(eq(referralCommissions.referrerId, user.id)).orderBy(desc(referralCommissions.createdAt)),
    db.select({ signups: count() }).from(users).where(eq(users.referredById, user.id)),
    db.select({ signupsThisMonth: count() }).from(users).where(and(eq(users.referredById, user.id), gte(users.createdAt, monthStart))),
    record.discountCodeId ? db.select().from(discountCodes).where(eq(discountCodes.id, record.discountCodeId)) : Promise.resolve([]),
    withCohorts(await getPublishedCourses()),
    ambassadorLeaderboard(monthStart, 500),
  ]);

  const now = new Date();
  const totals: Record<CommissionState, Map<string, number>> = { pending: new Map(), ready: new Map(), paid: new Map(), cancelled: new Map() };
  const byCourse = new Map<string, { students: Set<number | null>; earned: Map<string, number> }>();
  const monthEarned = new Map<string, number>();
  for (const c of commissions) {
    const state = commissionState(c, now);
    add(totals[state], c.currency, c.amount);
    if (state === "cancelled") continue;
    if (c.createdAt >= monthStart) add(monthEarned, c.currency, c.amount);
    const row = byCourse.get(c.courseTitle) ?? { students: new Set(), earned: new Map() };
    row.students.add(c.referredUserId);
    add(row.earned, c.currency, c.amount);
    byCourse.set(c.courseTitle, row);
  }
  const students = new Set(commissions.filter((c) => c.status !== "cancelled").map((c) => c.referredUserId)).size;
  const studentsThisMonth = new Set(commissions.filter((c) => c.status !== "cancelled" && c.createdAt >= monthStart).map((c) => c.referredUserId)).size;

  const rate = ambassadorRate(record, config);
  const active = record.status === "active" && config.enabled;
  const codeLive = active && discount?.active && discount.percentOff > 0;
  const currencies = [currencyForCountry(user.country), ...settings.currencies].filter((c): c is string => Boolean(c));
  const offers = courses.filter((course) => course.referralPercent !== 0).map((course) => {
    const open = course.cohorts.filter((c) => c.enrollmentOpen);
    const price = fromPrice(open.length ? open : course.cohorts, currencies);
    return { course, earn: price && price !== "free" ? formatMoney(Math.round((price.amount * rate) / 100), price.currency) : null };
  });
  const myRank = board.findIndex((r) => r.userId === user.id);
  const top = board.slice(0, 10);
  const payout = user.payoutDetails;
  const link = referralLink(code);
  const month = now.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });

  return (
    <>
      <PageHeader title="Ambassador dashboard" description={`You earn ${rate}% of what every student you bring pays, on every course they take.`} />
      {!active && <Notice tone="amber">{record.status === "paused" ? "Your ambassador account is paused, so your code is switched off and new sales earn the normal Refer & earn rate. Contact us if you think this is a mistake." : "The ambassador programme is closed for now. New sales earn the normal Refer & earn rate."}</Notice>}

      <section className="relative overflow-hidden rounded-[5px] bg-[linear-gradient(135deg,#5b4be0_0%,#4f3fd7_45%,#3d2fb8_100%)] px-6 py-7 text-white sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border border-white/10" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="flex flex-col gap-3">
            <span className="flex w-fit items-center gap-2 rounded-full bg-white/[.12] px-3 py-1 text-xs font-semibold"><AwardIcon className="size-4 text-[#b9f0ff]" /> {settings.siteName} ambassador</span>
            <h2 className="font-display text-[28px] font-bold leading-tight tracking-[-0.5px] sm:text-[34px]">Earn {rate}% on every course</h2>
            {codeLive ? (
              <p className="max-w-[460px] text-[15px] leading-relaxed text-white/80">Your audience gets <strong className="text-white">{discount!.percentOff}% off</strong> with your code. Every sale using it counts as yours, even without your link.</p>
            ) : (
              <p className="max-w-[460px] text-[15px] leading-relaxed text-white/80">Share your link: people who sign up through it within {referrals.cookieDays} days count as yours.</p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <ReferralShare link={link} message={`I recommend ${settings.siteName} for practical tech courses with live classes.${codeLive ? ` Use my code ${discount!.code} for ${discount!.percentOff}% off:` : " Have a look:"}`} />
            <p className="text-[13px] text-white/65">
              {codeLive ? <>Your discount code: <span className="font-mono text-base font-semibold text-white">{discount!.code}</span></> : <>Your referral code: <span className="font-mono font-semibold text-white">{code}</span></>}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Link visits" value={user.referralClicks.toLocaleString()} icon={LinkIcon} tone="purple" hint={`${signups.toLocaleString()} signed up · ${signupsThisMonth} this month`} />
        <StatTile label="Paying students" value={students.toLocaleString()} icon={UsersIcon} tone="cyan" hint={`${studentsThisMonth} in ${month}`} />
        <StatTile label={`Earned in ${month}`} value={money(monthEarned)} icon={TrendIcon} tone="navy" hint={totals.pending.size ? `${money(totals.pending)} waiting for the refund window` : undefined} />
        <StatTile label="Ready to pay" value={money(totals.ready)} icon={GiftIcon} tone="green" hint={totals.paid.size ? `${money(totals.paid)} paid so far` : undefined} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Share a course" padded={false}>
            {offers.length ? (
              <ul className="divide-y divide-line">
                {offers.map(({ course, earn }) => (
                  <li key={course.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 md:px-6">
                    <div className="min-w-0 grow">
                      <p className="font-semibold text-ink">{course.title}</p>
                      <p className="text-sm text-muted">{earn ? <>About <strong className="font-semibold text-ink">{earn}</strong> per student</> : `${rate}% of what they pay`}</p>
                    </div>
                    <CopyLinkButton link={referralLink(code, `/courses/${course.slug}`)} />
                  </li>
                ))}
              </ul>
            ) : <p className="p-6 text-muted">No courses are open right now.</p>}
          </Card>

          <Card title="Earnings by course" padded={false}>
            {byCourse.size ? (
              <ul className="divide-y divide-line">
                {[...byCourse].sort((a, b) => b[1].students.size - a[1].students.size).map(([title, row]) => (
                  <li key={title} className="flex items-center justify-between gap-4 px-5 py-4 md:px-6">
                    <div className="min-w-0"><p className="font-semibold text-ink">{title}</p><p className="text-sm text-muted">{row.students.size} {row.students.size === 1 ? "student" : "students"}</p></div>
                    <p className="font-semibold text-ink">{money(row.earned)}</p>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={CardIcon} title="No earnings yet">When someone you bring pays for a course, it shows here.</EmptyState>}
          </Card>

          <Card title="Recent commissions" padded={false}>
            {commissions.length ? (
              <ul className="divide-y divide-line">
                {commissions.slice(0, 20).map((c) => {
                  const state = commissionState(c, now);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 md:px-6">
                      <div className="min-w-0"><p className="font-medium text-ink">{c.courseTitle}</p><p className="text-xs text-muted">{relativeTime(c.createdAt)} · {c.source === "code" ? "used your code" : "through your link"} · {c.percent}%</p></div>
                      <span className="flex items-center gap-2"><span className={`font-semibold ${state === "cancelled" ? "text-muted line-through" : "text-ink"}`}>{formatMoney(c.amount, c.currency)}</span><Badge tone={STATE[state].tone}>{STATE[state].label}</Badge></span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="p-6 text-sm text-muted">Nothing yet.</p>}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title={`Leaderboard: ${month}`} padded={false}>
            {top.length ? (
              <ol className="divide-y divide-line">
                {top.map((row, i) => (
                  <li key={row.userId} className={`flex items-center gap-3 px-5 py-3 ${row.userId === user.id ? "bg-accent-soft/50" : ""}`}>
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${i < 3 ? "bg-accent text-white" : "bg-page text-muted"}`}>{i + 1}</span>
                    <span className="min-w-0 grow truncate font-medium text-ink">{row.name}{row.userId === user.id && <span className="text-muted"> (you)</span>}</span>
                    <span className="text-sm font-semibold text-ink">{row.students} {row.students === 1 ? "student" : "students"}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="px-5 py-6 text-sm text-muted">No sales yet this month. The first student puts you at the top.</p>}
            {myRank >= 10 && <p className="border-t border-line px-5 py-3 text-sm text-muted">You&apos;re <strong className="text-ink">#{myRank + 1}</strong> this month with {board[myRank].students} {board[myRank].students === 1 ? "student" : "students"}.</p>}
            {myRank < 0 && top.length > 0 && <p className="border-t border-line px-5 py-3 text-sm text-muted">Bring your first paying student this month to join the board.</p>}
          </Card>

          <Card title="Where should we pay you?">
            {!payout && totals.ready.size > 0 && <div className="mb-4"><Notice tone="amber">You have commission ready. Add your details so we can pay you.</Notice></div>}
            <ActionForm action={savePayoutDetails}>
              <PayoutMethod
                initial={payout?.method ?? "bank"}
                other={<Textarea label="How should we pay you?" name="other" defaultValue={payout?.other} rows={3} placeholder="e.g. PayPal: you@example.com" />}
              >
                <Input label="Bank" name="bankName" defaultValue={payout?.bankName} placeholder="e.g. GTBank" />
                <Input label="Account name" name="accountName" defaultValue={payout?.accountName ?? user.name} />
                <Input label="Account number" name="accountNumber" defaultValue={payout?.accountNumber} inputMode="numeric" />
              </PayoutMethod>
              <SubmitButton>{payout ? "Update details" : "Save details"}</SubmitButton>
            </ActionForm>
          </Card>

          <Card title="Good to know">
            <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-body">
              <li>Commission is worked out on what the student actually pays, after any discount.</li>
              <li>It&apos;s payable {referrals.holdDays ? `${referrals.holdDays} days after they pay, once the refund window has passed` : "once they pay"}. Refunds reduce or cancel it.</li>
              <li>You can&apos;t earn on your own purchases, or on people who already had an account before clicking your link.</li>
              <li>Questions? <Link href="/contact" className="font-semibold text-accent-ink">Contact us</Link>.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
