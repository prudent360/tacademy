import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AwardIcon, CardIcon, ChartIcon, CheckIcon, GiftIcon, LinkIcon, TrendIcon, UsersIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { HeroHighlight, HeroVisual, PageHero, heroButton } from "@/components/site/page-hero";
import { ambassadorConfig } from "@/lib/ambassadors";
import { getSettings } from "@/lib/data";
import { referralConfig } from "@/lib/referrals";
import { pageMetadata, seoConfig } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [seo, config] = await Promise.all([seoConfig(), ambassadorConfig()]);
  return pageMetadata(seo, { title: "Become an ambassador", description: `Share courses you believe in and earn ${config.percent}% of every enrolment you bring, on every course they take.`, path: "/ambassadors" });
}

const APPLY = "/account/ambassador";

export default async function AmbassadorsPage() {
  const [config, settings, referrals] = await Promise.all([ambassadorConfig(), getSettings(), referralConfig()]);
  if (!config.enabled) notFound();
  const discount = config.discountPercent > 0;

  const benefits = [
    { icon: CardIcon, title: `Earn ${config.percent}% on every course`, text: "A share of what every student you bring pays, on their first course and every one after it." },
    ...(discount ? [{ icon: GiftIcon, title: `Give ${config.discountPercent}% off`, text: "Your own discount code for your followers. Every sale that uses it counts as yours, even without your link." }] : []),
    { icon: ChartIcon, title: "Your own dashboard", text: "See clicks, sign-ups, paying students and earnings by course, with a share link for every course." },
    { icon: TrendIcon, title: "Monthly leaderboard", text: "See how you rank against other ambassadors each month." },
    { icon: LinkIcon, title: "Ready-made links", text: "One link for the academy and one for each course, ready to post anywhere." },
    { icon: AwardIcon, title: "Paid reliably", text: `Commission becomes payable ${referrals.holdDays ? `${referrals.holdDays} days after a student pays, once the refund window has passed` : "as soon as a student pays"}, straight to your bank.` },
  ];
  const steps = [
    { title: "Apply", text: "Create an account and tell us who you reach and where. It takes two minutes." },
    { title: "Get approved", text: `We review every application. Once approved, you get your link${discount ? " and personal discount code" : ""}.` },
    { title: "Share", text: "Post your links and code to your audience: socials, groups, your classmates or colleagues." },
    { title: "Earn", text: `When people you bring pay for a course, you earn ${config.percent}% of what they pay.` },
  ];
  const faqs = [
    { q: "Who can become an ambassador?", a: "Anyone with an audience who'd benefit from our courses: students and graduates, content creators, community leaders, lecturers and career coaches." },
    { q: "How is a student counted as mine?", a: `Either they create their account within ${referrals.cookieDays} days of clicking your link${discount ? ", or they pay using your discount code" : ""}. People who already had an account before clicking don't count.` },
    { q: "How and when am I paid?", a: "Add your bank details on your dashboard. Commission becomes payable after the refund window and we pay it to you directly. Refunds reduce or cancel the commission on that payment." },
    { q: "What if I'm not approved?", a: `You can still earn through Refer & earn: every account has a personal link${referrals.enabled ? ` that pays ${referrals.percent}%` : ""}.` },
  ];

  return (
    <>
      <PageHero
        eyebrow="Ambassador programme"
        title={<>Become a {settings.siteName} <HeroHighlight>ambassador</HeroHighlight></>}
        lead={`Share practical tech courses with the people you know, and earn ${config.percent}% of what every student you bring pays.${discount ? ` Your audience gets ${config.discountPercent}% off with your personal code.` : ""}`}
        actions={<>
          <Link href={APPLY} className={heroButton.primary}>Apply now <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
          <a href="#how" className={heroButton.secondary}>How it works</a>
        </>}
        facts={[
          { icon: CardIcon, label: "Commission", value: `${config.percent}% on every course` },
          { icon: UsersIcon, label: discount ? "Your audience saves" : "To apply", value: discount ? `${config.discountPercent}% with your code` : "About 2 minutes" },
        ]}
        aside={
          <HeroVisual notes={[{ icon: GiftIcon, title: `You earned ${config.percent}%`, text: "A student joined with your code" }, { icon: CheckIcon, title: "Application approved" }]}>
            <Image src="/images/home-hero-team.webp" alt="Students learning together" width={1120} height={840} priority sizes="(min-width: 1024px) 540px, 100vw" className="aspect-[4/3] w-full object-cover" />
          </HeroVisual>
        }
      />

      <section className="border-y border-line bg-panel">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-16 sm:px-8 md:py-20">
          <div className="flex max-w-[640px] flex-col gap-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent">Why join</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">Help people start in tech, and earn for it</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex flex-col gap-3 rounded-[5px] border border-edge bg-white p-6">
                <span className="flex size-11 items-center justify-center rounded-[5px] bg-accent-soft text-accent"><Icon className="size-5" /></span>
                <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
                <p className="text-[15px] leading-6 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {config.pitch && (
        <section className="mx-auto flex max-w-[860px] flex-col gap-4 px-5 py-16 sm:px-8 md:py-20">
          <Markdown size="lg">{config.pitch}</Markdown>
        </section>
      )}

      <section id="how" className={`scroll-mt-28 ${config.pitch ? "border-y border-line bg-panel" : ""}`}>
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-16 sm:px-8 md:py-20">
          <div className="flex max-w-[640px] flex-col gap-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent">How it works</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">From application to your first commission</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3 rounded-[5px] border border-edge bg-white p-6">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent font-mono text-sm font-semibold text-white">0{i + 1}</span>
                <h3 className="font-display text-lg font-bold text-ink">{step.title}</h3>
                <p className="text-[15px] leading-6 text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto flex max-w-[860px] flex-col gap-8 px-5 py-16 sm:px-8 md:py-20">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">Questions ambassadors ask</h2>
        <div className="divide-y divide-line rounded-[5px] border border-edge bg-white">
          {faqs.map((faq) => (
            <details key={faq.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold text-ink [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-8">
        <div className="flex flex-col items-start gap-6 rounded-[5px] bg-[linear-gradient(120deg,#211a5c_0%,#3d2fb8_100%)] px-7 py-10 text-white sm:px-12 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-2xl font-bold md:text-3xl">Ready to start earning?</h2>
            <p className="max-w-[520px] text-white/75">Apply in about two minutes. We review every application and email you with the outcome.</p>
          </div>
          <Link href={APPLY} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-[5px] bg-white px-6 font-semibold text-accent transition hover:-translate-y-0.5">Apply now <ArrowRight className="size-4" /></Link>
        </div>
      </section>
    </>
  );
}
