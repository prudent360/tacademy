import type { Metadata } from "next";
import { count, desc, eq } from "drizzle-orm";
import { savePayoutDetails } from "@/app/actions/referrals";
import { ActionForm, Input, SubmitButton, Textarea } from "@/components/forms";
import { CheckCircleIcon, ClockIcon, GiftIcon, LinkIcon, UsersIcon } from "@/components/icons";
import { StatTile } from "@/components/portal/dash";
import { CopyLinkButton, PayoutMethod, ReferralShare } from "@/components/portal/referral-share";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { referralCommissions, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fromPrice, withCohorts } from "@/lib/catalog";
import { currencyForCountry } from "@/lib/countries";
import { getPublishedCourses, getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { commissionState, ensureReferralCode, referralConfig, referralLink, type CommissionState } from "@/lib/referrals";
import { formatDateOnly } from "@/lib/time";

export const metadata: Metadata = { title: "Refer & earn" };

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

export default async function ReferralsPage() {
  const [user, cfg, settings] = await Promise.all([requireUser(), referralConfig(), getSettings()]);
  if (!cfg.enabled) {
    return <>
      <PageHeader title="Refer & earn" />
      <EmptyState icon={GiftIcon} title="Referrals aren't open right now">Check back soon: when they are, you&apos;ll earn a commission for everyone you bring to {settings.siteName}.</EmptyState>
    </>;
  }
  const code = await ensureReferralCode(user);
  const db = await getDb();
  const [commissions, referred, [{ signups }], courses] = await Promise.all([
    db.select().from(referralCommissions).where(eq(referralCommissions.referrerId, user.id)).orderBy(desc(referralCommissions.createdAt)),
    db.select({ id: users.id, name: users.name, createdAt: users.createdAt }).from(users).where(eq(users.referredById, user.id)).orderBy(desc(users.createdAt)).limit(100),
    db.select({ signups: count() }).from(users).where(eq(users.referredById, user.id)),
    withCohorts(await getPublishedCourses()),
  ]);

  const now = new Date();
  const totals: Record<CommissionState, Map<string, number>> = { pending: new Map(), ready: new Map(), paid: new Map(), cancelled: new Map() };
  for (const c of commissions) {
    const t = totals[commissionState(c, now)];
    t.set(c.currency, (t.get(c.currency) ?? 0) + c.amount);
  }
  const joined = new Set(commissions.filter((c) => c.status !== "cancelled").map((c) => c.referredUserId)).size;
  const currencies = [currencyForCountry(user.country), ...settings.currencies].filter((c): c is string => Boolean(c));
  const offers = courses
    .map((course) => {
      const percent = course.referralPercent ?? cfg.percent;
      const open = course.cohorts.filter((c) => c.enrollmentOpen);
      const price = fromPrice(open.length ? open : course.cohorts, currencies);
      return { course, percent, earn: price && price !== "free" ? formatMoney(Math.round((price.amount * percent) / 100), price.currency) : null };
    })
    .filter((o) => o.percent > 0);
  const top = Math.max(cfg.percent, ...offers.map((o) => o.percent));
  const varies = offers.some((o) => o.percent !== cfg.percent);
  const link = referralLink(code);
  const payout = user.payoutDetails;
  const rows = referred.map((person) => ({ person, earned: commissions.filter((c) => c.referredUserId === person.id) }));

  return (
    <>
      <PageHeader title="Refer & earn" description={`Share ${settings.siteName} with friends and colleagues, and earn a commission when they join a course.`} />

      <section className="relative overflow-hidden rounded-[5px] bg-[linear-gradient(135deg,#5b4be0_0%,#4f3fd7_45%,#3d2fb8_100%)] px-6 py-7 text-white sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 right-24 size-80 rounded-full bg-white/[.05]" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="flex flex-col gap-3">
            <span className="flex size-12 items-center justify-center rounded-[5px] bg-white/[.12]"><GiftIcon className="size-6 text-[#b9f0ff]" /></span>
            <h2 className="font-display text-[28px] font-bold leading-tight tracking-[-0.5px] sm:text-[34px]">Earn {varies ? "up to " : ""}{top}% for every friend who joins</h2>
            <p className="max-w-[460px] text-[15px] leading-relaxed text-white/80">When someone signs up through your link and pays for a course, you get {varies ? "a share" : `${top}%`} of what they pay.</p>
          </div>
          <div className="flex flex-col gap-3">
            <ReferralShare link={link} message={`I've been learning with ${settings.siteName}: practical tech courses with live classes. Have a look:`} />
            <p className="text-[13px] text-white/65">Your code: <span className="font-mono font-semibold text-white">{code}</span></p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Link visits" value={user.referralClicks.toLocaleString()} icon={LinkIcon} tone="purple" />
        <StatTile label="Signed up" value={signups.toLocaleString()} icon={UsersIcon} tone="cyan" hint={joined ? `${joined} joined a course` : undefined} />
        <StatTile label="Waiting" value={money(totals.pending)} icon={ClockIcon} tone="navy" hint={cfg.holdDays ? `Payable ${cfg.holdDays} days after they pay` : "Payable once they pay"} />
        <StatTile label="Ready to pay" value={money(totals.ready)} icon={GiftIcon} tone="green" hint={totals.paid.size ? `${money(totals.paid)} paid so far` : undefined} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="What you can earn" padded={false}>
            {offers.length ? (
              <ul className="divide-y divide-line">
                {offers.map(({ course, percent, earn }) => (
                  <li key={course.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 md:px-6">
                    <div className="min-w-0 grow">
                      <p className="font-semibold text-ink">{course.title}</p>
                      <p className="text-sm text-muted">{earn ? <>About <strong className="font-semibold text-ink">{earn}</strong> per person who joins</> : "Commission on what they pay"}</p>
                    </div>
                    <Badge tone="accent">{percent}%</Badge>
                    <CopyLinkButton link={referralLink(code, `/courses/${course.slug}`)} />
                  </li>
                ))}
              </ul>
            ) : <p className="p-6 text-muted">No courses are open for referrals right now.</p>}
          </Card>

          <Card title="Your referrals" padded={false}>
            {rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-line bg-page text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-3 font-semibold">Person</th><th className="px-3 py-3 font-semibold">Joined</th><th className="px-3 py-3 font-semibold">Course</th><th className="px-5 py-3 text-right font-semibold">Your commission</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {rows.map(({ person, earned }) => {
                      // First name and initial only: their full details stay private.
                      const [first, ...rest] = person.name.split(" ");
                      const shown = `${first}${rest.length ? ` ${rest[rest.length - 1][0]}.` : ""}`;
                      return (
                        <tr key={person.id}>
                          <td className="px-5 py-3 font-semibold text-ink">{shown}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-muted">{formatDateOnly(person.createdAt.toISOString().slice(0, 10))}</td>
                          <td className="px-3 py-3 text-body">{earned.length ? [...new Set(earned.map((c) => c.courseTitle))].join(", ") : <span className="text-muted">Signed up, not enrolled yet</span>}</td>
                          <td className="px-5 py-3 text-right">
                            {earned.length ? (
                              <div className="flex flex-col items-end gap-1">
                                {earned.map((c) => {
                                  const state = commissionState(c, now);
                                  return <span key={c.id} className="flex items-center gap-2"><span className={`font-semibold ${state === "cancelled" ? "text-muted line-through" : "text-ink"}`}>{formatMoney(c.amount, c.currency)}</span><Badge tone={STATE[state].tone}>{STATE[state].label}</Badge></span>;
                                })}
                              </div>
                            ) : <span className="text-muted">–</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={UsersIcon} title="No referrals yet">Share your link above. People who sign up through it show here.</EmptyState>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
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

          <Card title="How it works">
            <ol className="flex flex-col gap-3 text-sm leading-relaxed text-body">
              {[
                "Share your link or a course link. It works for anyone who visits within " + cfg.cookieDays + " days of clicking it.",
                "They create an account and pay for a course. People who already have an account don't count, and nor do you.",
                `You earn ${varies ? "the course's" : `${cfg.percent}%`} commission on what they pay${cfg.scope === "first" ? " for their first course" : ""}, after any discount.`,
                `It's payable ${cfg.holdDays ? `${cfg.holdDays} days later, once the refund window has passed` : "straight away"}. Refunds reduce or cancel it.`,
                "We pay to the details you've saved and email you when we do.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-bold text-accent">{i + 1}</span><span>{step}</span></li>
              ))}
            </ol>
            {cfg.terms && <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-[13px] text-muted">{cfg.terms}</p>}
            {totals.paid.size > 0 && <p className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-sm text-emerald-700"><CheckCircleIcon className="size-4" /> {money(totals.paid)} paid to you so far.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
