import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AwardIcon, BookIcon, BriefcaseIcon, CalendarIcon, CheckIcon, ChevronRight, ClockIcon, LayersIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { CourseArt } from "@/components/site/course-art";
import { HeroVisual, PageHero, heroButton } from "@/components/site/page-hero";
import { ModeBadge } from "@/components/ui";
import { withCohorts } from "@/lib/catalog";
import { getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { getProgrammeBySlug, instalmentPlan, programmeCourseMap, programmeFee, separateTotal } from "@/lib/programmes";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { absoluteUrl, jsonLd } from "@/lib/site";
import { formatDateOnly } from "@/lib/time";
import { visitorCurrencies } from "@/lib/visitor";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [programme, seo] = await Promise.all([getProgrammeBySlug((await params).slug), seoConfig()]);
  if (!programme) return {};
  return pageMetadata(seo, { title: programme.seoTitle || programme.title, description: programme.seoDescription || programme.summary, path: `/programmes/${programme.slug}`, image: programme.imageUrl || programme.heroImageUrl });
}

export default async function ProgrammePage({ params }: Props) {
  const programme = await getProgrammeBySlug((await params).slug);
  if (!programme) notFound();
  const [settings, included] = await Promise.all([getSettings(), programmeCourseMap([programme.id], { publishedOnly: true })]);
  const list = included.get(programme.id) ?? [];
  if (list.length < 2) notFound();
  const [summaries, { currencies }] = await Promise.all([withCohorts(list), visitorCurrencies(settings)]);
  const fee = programmeFee(programme.prices, currencies);
  const separately = fee ? separateTotal(summaries, fee.currency) : null;
  const saving = fee && separately && separately > fee.amount ? separately - fee.amount : 0;
  const plan = fee ? instalmentPlan(fee.amount, programme.instalmentCount, programme.instalmentFirstPercent) : null;
  const weeks = summaries.reduce((sum, c) => sum + (c.durationWeeks ?? 0), 0);
  const first = summaries[0];
  const supportEmail = settings.supportEmail || "hello@tekskillup.com";
  const enquire = `mailto:${supportEmail}?subject=${encodeURIComponent(`Programme enquiry: ${programme.title}`)}`;
  const today = new Date().toISOString().slice(0, 10);
  const cover = programme.imageUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={programme.imageUrl} alt="" className="aspect-[16/10] w-full object-cover" />
    : <CourseArt seed={programme.id + 1000} className="aspect-[16/10] w-full" />;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOccupationalProgram",
    name: programme.title,
    description: programme.summary,
    url: absoluteUrl(`/programmes/${programme.slug}`),
    provider: { "@type": "EducationalOrganization", name: settings.siteName, url: absoluteUrl("/") },
    hasCourse: summaries.map((c) => ({ "@type": "Course", name: c.title, url: absoluteUrl(`/courses/${c.slug}`) })),
    ...(fee ? { offers: { "@type": "Offer", price: fee.amount / 100, priceCurrency: fee.currency } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <PageHero
        photo={programme.heroImageUrl}
        breadcrumb={<nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5"><Link href="/programmes" className="font-semibold text-white/80 transition hover:text-white">Programmes</Link><ChevronRight className="size-4 shrink-0 text-white/40" /><span aria-current="page" className="truncate">{programme.title}</span></nav>}
        eyebrow={programme.category || "Programme"}
        title={programme.title}
        lead={programme.summary}
        actions={<>
          <a href={enquire} className={heroButton.primary}>Enquire about this programme <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></a>
          <a href="#path" className={heroButton.secondary}>See the courses</a>
        </>}
        facts={[
          { icon: ClockIcon, label: "Duration", value: programme.duration },
          { icon: BookIcon, label: "Courses", value: `${summaries.length} in sequence` },
          { icon: LayersIcon, label: "Level", value: programme.level },
          { icon: AwardIcon, label: "Credential", value: "A certificate per course" },
        ]}
        aside={programme.heroImageUrl ? undefined : <HeroVisual notes={[{ icon: BookIcon, title: `${summaries.length} courses`, text: weeks ? `About ${weeks} weeks of classes` : undefined }]}>{cover}</HeroVisual>}
      >
        {fee && (
          <p className="text-sm text-white/90">
            <span className="text-white/75">Programme fee </span><strong className="font-display text-2xl font-bold text-white">{formatMoney(fee.amount, fee.currency)}</strong>
            {saving > 0 && <span className="ml-3 inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">Save {formatMoney(saving, fee.currency)}</span>}
            {plan && <span className="mt-1 block text-white/80">or {plan.count} monthly payments{plan.first === plan.rest ? ` of ${formatMoney(plan.rest, fee.currency)}` : `, first payment ${formatMoney(plan.first, fee.currency)}`}</span>}
          </p>
        )}
      </PageHero>

      <div className="mx-auto grid max-w-[1200px] items-start gap-10 px-5 py-12 sm:px-8 md:py-16 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-10">
          {programme.description && (
            <section className="flex flex-col gap-4">
              <div><p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">About the programme</p><h2 className="mt-2 font-display text-2xl font-bold text-ink">What this programme is designed to do</h2></div>
              <Markdown>{programme.description}</Markdown>
            </section>
          )}

          <section id="path" className="scroll-mt-28 flex flex-col gap-5">
            <div><p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Your path</p><h2 className="mt-2 font-display text-2xl font-bold text-ink">The courses, in order</h2><p className="mt-2 text-[15px] text-muted">Each course runs in live cohorts. You take them one after another and earn a certificate for each.</p></div>
            <ol className="flex flex-col gap-4">
              {summaries.map((course, i) => {
                const modes = [...new Set(course.cohorts.map((c) => c.deliveryMode))];
                const start = course.nextCohort?.startDate;
                return (
                  <li key={course.id} className="grid gap-4 rounded-[5px] border border-edge bg-white p-5 sm:grid-cols-[44px_1fr]">
                    <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft font-mono text-sm font-bold text-accent">{String(i + 1).padStart(2, "0")}</span>
                    <div className="flex min-w-0 flex-col gap-2">
                      <h3 className="font-display text-lg font-bold text-ink">{course.title}</h3>
                      <p className="text-[15px] leading-6 text-muted">{course.summary}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-body">
                        {course.durationWeeks && <span className="flex items-center gap-1.5"><ClockIcon className="size-4 text-muted" /> {course.durationWeeks} weeks</span>}
                        <span className="flex items-center gap-1.5"><CalendarIcon className="size-4 text-muted" /> {start ? `${start < today ? "Started" : "Next starts"} ${formatDateOnly(start)}` : "Dates coming soon"}</span>
                        {modes.map((m) => <ModeBadge key={m} mode={m} />)}
                      </div>
                      <Link href={`/courses/${course.slug}`} className="mt-1 flex w-fit items-center gap-1 text-sm font-semibold text-accent hover:underline">View course details <ArrowRight className="size-4" /></Link>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {programme.outcomes.length > 0 && (
            <section className="rounded-[5px] border border-edge bg-white p-6 md:p-7">
              <h2 className="font-display text-2xl font-bold text-ink">What you&apos;ll be able to do</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {programme.outcomes.map((o) => <li key={o} className="flex gap-2.5 text-[15px] leading-relaxed text-body"><CheckIcon className="mt-0.5 size-5 shrink-0 text-accent" /> {o}</li>)}
              </ul>
            </section>
          )}

          {programme.jobRoles.length > 0 && (
            <section className="flex flex-col gap-4 rounded-[5px] border border-accent-muted/40 bg-[linear-gradient(135deg,#f6f5ff_0%,#eeecff_100%)] p-6 sm:flex-row sm:items-start sm:gap-6 sm:p-7">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[5px] bg-white text-accent shadow-[0_8px_20px_-12px_rgba(79,63,215,.6)]"><BriefcaseIcon className="size-6" /></span>
              <div className="flex min-w-0 flex-col gap-3">
                <h2 className="font-display text-xl font-bold text-ink">Roles this prepares you for</h2>
                <ul className="flex flex-wrap gap-2">{programme.jobRoles.map((role) => <li key={role} className="rounded-full border border-accent-muted/50 bg-white px-3.5 py-1.5 text-sm font-semibold text-accent-ink">{role}</li>)}</ul>
              </div>
            </section>
          )}
        </div>

        <aside id="fees" className="flex flex-col gap-4 rounded-[5px] border border-edge bg-white p-6 lg:sticky lg:top-28">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Programme fee</p>
          {fee ? (
            <>
              <p className="font-display text-4xl font-bold text-ink">{formatMoney(fee.amount, fee.currency)}</p>
              {saving > 0 && <p className="text-sm text-body"><span className="text-muted line-through">{formatMoney(separately!, fee.currency)}</span> if you take the courses separately. <strong className="text-emerald-700">You save {formatMoney(saving, fee.currency)}.</strong></p>}
            </>
          ) : <p className="font-display text-2xl font-bold text-ink">Contact us for fees</p>}
          {fee && plan && (
            <div className="rounded-[5px] border border-accent-muted/40 bg-accent-soft/50 p-4">
              <p className="text-sm font-semibold text-ink">Or pay in {plan.count} monthly instalments</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-body">
                {plan.first === plan.rest
                  ? <li className="flex justify-between gap-3"><span>{plan.count} payments of</span><strong className="text-ink">{formatMoney(plan.rest, fee.currency)}</strong></li>
                  : <>
                      <li className="flex justify-between gap-3"><span>First payment</span><strong className="text-ink">{formatMoney(plan.first, fee.currency)}</strong></li>
                      <li className="flex justify-between gap-3"><span>Then {plan.count - 1} monthly payment{plan.count === 2 ? "" : "s"} of</span><strong className="text-ink">{formatMoney(plan.rest, fee.currency)}</strong></li>
                    </>}
              </ul>
            </div>
          )}
          {programme.feeNote && <p className="text-sm text-muted">{programme.feeNote}</p>}
          <ul className="flex flex-col gap-2 border-t border-line pt-4 text-sm text-body">
            <li className="flex gap-2"><ClockIcon className="size-4 shrink-0 text-accent" /> {programme.duration}</li>
            <li className="flex gap-2"><BookIcon className="size-4 shrink-0 text-accent" /> {summaries.length} courses, taught live</li>
            <li className="flex gap-2"><AwardIcon className="size-4 shrink-0 text-accent" /> A verified certificate for each course</li>
          </ul>
          <a href={enquire} className="flex h-12 items-center justify-center gap-2 rounded-[5px] bg-accent font-semibold text-white transition hover:bg-accent-dark">Enquire about this programme <ArrowRight className="size-4" /></a>
          {first && <Link href={`/courses/${first.slug}`} className="text-center text-sm font-semibold text-accent hover:underline">Or start with {first.title}</Link>}
        </aside>
      </div>
    </>
  );
}
