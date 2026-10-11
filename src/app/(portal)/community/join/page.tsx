import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { joinCommunity } from "@/app/actions/community";
import { ActionForm, Select, SubmitButton } from "@/components/forms";
import { CheckCircleIcon, MessageIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Badge, buttonClass, Card, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { communityAccess, communityConfig, isPaidCommunity } from "@/lib/community-access";
import { bankTransferConfig } from "@/lib/config";
import { getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { payableCurrencies } from "@/lib/payments";
import { visitorCurrencies } from "@/lib/visitor";

export const metadata: Metadata = { title: "Join the community" };

const DEFAULT_PITCH = `- Ask questions and get answers from instructors, graduates and fellow learners
- Share wins, projects and job leads
- Get feedback on your CV, portfolio and interview prep`;

const formatDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function JoinCommunityPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const [{ cancelled }, user, config, payable, bank, settings] = await Promise.all([searchParams, requireUser(), communityConfig(), payableCurrencies(), bankTransferConfig(), getSettings()]);
  if (!isPaidCommunity(config)) redirect("/community");
  const access = await communityAccess(user);
  // Students, graduates and the team are already in; only paying members renew.
  if (access.member && access.via !== "member") redirect("/community");

  const { currencies: preferred } = await visitorCurrencies(settings);
  const priced = Object.keys(config.prices).filter((code) => (config.prices[code] ?? 0) > 0);
  const online = [...priced].filter((code) => payable.includes(code)).sort((a, b) => (preferred.indexOf(a) + 1 || 99) - (preferred.indexOf(b) + 1 || 99));
  const bankPrice = bank.enabled ? config.prices[bank.currency] ?? 0 : 0;
  const period = config.months === 12 ? "a year" : config.months === 1 ? "a month" : `${config.months} months`;
  const renewing = access.via === "member";

  return (
    <>
      <PageHeader
        back={{ href: "/community", label: "Community" }}
        title={renewing ? "Renew your membership" : "Join the community"}
        description={renewing ? `You're a member until ${formatDate(access.endsAt)}. Renew now and the new period starts when this one ends.` : "Connect with instructors, graduates and other learners. Membership is included free with every course."}
      />
      {cancelled && <Notice tone="amber">Payment cancelled. You haven&apos;t been charged.</Notice>}
      {access.via === "none" && access.endedAt && <Notice tone="amber">Your membership ended on {formatDate(access.endedAt)}. Renew to pick up where you left off.</Notice>}
      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card title="What you get">
          <div className="flex flex-col gap-5">
            <Markdown>{config.pitch || DEFAULT_PITCH}</Markdown>
            <p className="flex items-start gap-2 rounded-lg bg-accent-soft px-4 py-3 text-sm text-navy">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0" />
              <span>Taking a course? Membership is free while you study and after you graduate. <Link href="/courses" className="font-semibold text-accent-ink">Browse courses</Link></span>
            </p>
          </div>
        </Card>
        <Card title={`Membership for ${period}`}>
          {online.length || bankPrice ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-2">
                {priced.map((code) => <Badge key={code} tone="accent">{formatMoney(config.prices[code]!, code)}</Badge>)}
              </div>
              {online.length > 0 && (
                <ActionForm action={joinCommunity} className="flex flex-col gap-4">
                  <input type="hidden" name="method" value="online" />
                  <Select label="Pay in" name="currency" defaultValue={online[0]} options={online.map((code) => ({ value: code, label: `${code}: ${formatMoney(config.prices[code]!, code)}` }))} />
                  <SubmitButton pendingText="Starting checkout…" block>{renewing ? "Renew and pay online" : "Join and pay online"}</SubmitButton>
                </ActionForm>
              )}
              {bankPrice > 0 && (
                <ActionForm action={joinCommunity} className="flex flex-col gap-3">
                  <input type="hidden" name="method" value="bank" />
                  <p className="text-sm text-muted">Or pay {formatMoney(bankPrice, bank.currency)} by bank transfer. Your access starts once we confirm it arrived.</p>
                  <button type="submit" className={buttonClass.secondary}>Pay by bank transfer</button>
                </ActionForm>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted"><MessageIcon className="size-4" /> Online payment isn&apos;t available right now. Please contact us to join.</p>
          )}
        </Card>
      </div>
    </>
  );
}
