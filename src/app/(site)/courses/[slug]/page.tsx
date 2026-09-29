import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AwardIcon, CalendarIcon, CardIcon, CheckIcon, ChevronRight, ClockIcon, LayersIcon, MonitorIcon, PinIcon, UsersIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { CourseArt } from "@/components/site/course-art";
import { CurriculumRequest } from "@/components/site/curriculum-request";
import { Avatar, Badge, ModeBadge, Notice } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isFree, withCohorts } from "@/lib/catalog";
import { getCourseBySlug, getInstructorsByCohort, getSettings, getStudentCohorts, linkedCourseTitles } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { cohortCurrencies } from "@/lib/pricing";
import type { Cohort } from "@/db/schema";
import { absoluteUrl, jsonLd } from "@/lib/site";
import { formatDateOnly } from "@/lib/time";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { visitorCurrencies } from "@/lib/visitor";

/** Default country code for the curriculum form's phone field, from the academy's main currency. */
const PHONE_COUNTRY: Record<string, string> = { NGN: "NG", GBP: "GB", USD: "US", CAD: "CA", EUR: "IE", GHS: "GH", KES: "KE", ZAR: "ZA" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ cancelled?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [course, seo] = await Promise.all([getCourseBySlug((await params).slug), seoConfig()]);
  if (!course) return {};
  return pageMetadata(seo, { title: course.seoTitle || course.title, description: course.seoDescription || course.summary, path: `/courses/${course.slug}`, image: course.imageUrl || course.heroImageUrl });
}

export default async function CoursePage({ params, searchParams }: Props) {
  const [{ slug }, { cancelled }] = await Promise.all([params, searchParams]);
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  const [settings, user, [summary]] = await Promise.all([getSettings(), getCurrentUser(), withCohorts([course])]);
  const cohorts = summary.cohorts;
  const instructorsByCohort = await getInstructorsByCohort(cohorts.map((c) => c.id));
  const instructors = [...new Map([...instructorsByCohort.values()].flat().map((i) => [i.id, i])).values()];
  const myCohortIds = new Set(user ? (await getStudentCohorts(user.id)).map((r) => r.cohort.id) : []);
  const [visitor, linkedTitles] = await Promise.all([visitorCurrencies(settings), course.kind === "internship" ? linkedCourseTitles([course.id]) : Promise.resolve(new Map<number, string[]>())]);
  const graduatesOf = linkedTitles.get(course.id) ?? [];
  const preferredCurrency = visitor.currencies.find((currency) => cohorts.some((cohort) => (cohort.prices[currency] ?? 0) > 0));
  const preferredPrices = preferredCurrency ? cohorts.map((cohort) => cohort.prices[preferredCurrency] ?? 0).filter((price) => price > 0) : [];
  const startingPrice = preferredCurrency && preferredPrices.length ? formatMoney(Math.min(...preferredPrices), preferredCurrency) : cohorts.some(isFree) ? "Free" : null;
  const deliveryModes = [...new Set(cohorts.map((cohort) => cohort.deliveryMode))].map((mode) => mode === "virtual" ? "Online" : mode === "physical" ? "In person" : "Hybrid").join(" or ");
  const phoneCountry = visitor.country ?? PHONE_COUNTRY[preferredCurrency ?? settings.currencies[0] ?? ""];
  const photo = course.heroImageUrl;
  const secondaryButton = photo
    ? "inline-flex h-12 cursor-pointer items-center rounded-[5px] border border-white/40 bg-white/10 px-6 font-semibold text-white backdrop-blur transition hover:bg-white/20"
    : "inline-flex h-12 cursor-pointer items-center rounded-[5px] border border-edge-strong bg-white px-6 font-semibold text-ink transition hover:border-accent-muted hover:bg-panel";
  const courseNav = [course.description && { href: "#overview", label: "Overview" }, course.curriculum.length > 0 && { href: "#curriculum", label: "Curriculum" }, course.outcomes.length > 0 && { href: "#outcomes", label: "Outcomes" }, { href: "#cohorts", label: "Dates & fees" }].filter(Boolean) as { href: string; label: string }[];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.summary,
    url: absoluteUrl(`/courses/${course.slug}`),
    provider: { "@type": "EducationalOrganization", name: settings.siteName, url: absoluteUrl("/") },
    hasCourseInstance: cohorts.map((c) => ({
      "@type": "CourseInstance",
      name: c.name,
      courseMode: c.deliveryMode === "virtual" ? "online" : c.deliveryMode === "physical" ? "onsite" : "blended",
      startDate: c.startDate ?? undefined,
      endDate: c.endDate ?? undefined,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <section data-under-header={photo ? "" : undefined} className={photo ? "relative overflow-hidden bg-navy" : "border-b border-line bg-white"}>
        {photo && (
          <div aria-hidden="true" className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" fetchPriority="high" className="size-full object-cover object-center" />
            {/* Dark behind the text on the left, fading into brand purple at the bottom. */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(25,17,46,.92)_0%,rgba(25,17,46,.78)_45%,rgba(25,17,46,.35)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(90,36,184,.75)_100%)]" />
          </div>
        )}
        <div className={`relative mx-auto grid max-w-[1200px] items-center gap-10 px-5 sm:px-8 ${photo ? "py-16 md:py-24" : "py-12 md:py-16 lg:grid-cols-[1.3fr_1fr]"}`}>
          <div className={`flex flex-col gap-5 ${photo ? "max-w-[720px]" : ""}`}>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm"><Link href={course.kind === "internship" ? "/internships" : "/courses"} className={`font-semibold transition ${photo ? "text-white/75 hover:text-white" : "text-muted hover:text-accent"}`}>{course.kind === "internship" ? "Internships" : "Courses"}</Link><ChevronRight className={`size-4 shrink-0 ${photo ? "text-white/50" : "text-muted/60"}`} /><span aria-current="page" className={`truncate ${photo ? "text-white/75" : "text-muted"}`}>{course.title}</span></nav>
            <div className="flex flex-wrap items-center gap-2">{cohorts.some((cohort) => cohort.enrollmentOpen && !cohort.full) && <Badge tone="green">Registration open</Badge>}{course.category && <p className={`font-mono text-xs font-medium uppercase tracking-[1.5px] md:text-[13px] ${photo ? "text-cyan-light" : "text-accent"}`}>{course.category}</p>}</div>
            <h1 className={`font-display text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl ${photo ? "text-white [text-shadow:0_2px_24px_rgba(0,0,0,.35)] lg:text-[58px]" : "text-ink"}`}>{course.title}</h1>
            <p className={`max-w-[620px] text-lg leading-relaxed ${photo ? "text-white/80" : "text-muted"}`}>{course.summary}</p>
            <div className={`flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium ${photo ? "text-white/90" : "text-body"}`}><span className="flex items-center gap-2"><LayersIcon className={`size-4 ${photo ? "text-cyan-light" : "text-accent"}`} />{course.level}</span><span className="flex items-center gap-2"><CalendarIcon className={`size-4 ${photo ? "text-cyan-light" : "text-accent"}`} />{cohorts.length ? `${cohorts.length} upcoming ${cohorts.length === 1 ? "cohort" : "cohorts"}` : "New dates soon"}</span></div>
            {startingPrice && <div><p className={`text-xs font-semibold uppercase tracking-[1.2px] ${photo ? "text-white/60" : "text-muted"}`}>{startingPrice === "Free" ? "Course fee" : "From"}</p><p className={`mt-1 font-display text-3xl font-bold tracking-tight ${photo ? "text-emerald-400" : "text-ink"}`}>{startingPrice}</p></div>}
            <div className="flex flex-wrap gap-3">{cohorts.some((cohort) => cohort.enrollmentOpen && !cohort.full) ? <Link href={`/enroll?course=${course.slug}`} className="inline-flex h-12 items-center gap-2 rounded-[5px] bg-accent px-6 font-semibold text-white shadow-[0_10px_24px_-14px_rgba(113,52,217,.9)] transition hover:-translate-y-0.5 hover:bg-accent-dark">Enrol now <ArrowRight className="size-4" /></Link> : <a href="#cohorts" className="inline-flex h-12 items-center gap-2 rounded-[5px] bg-accent px-6 font-semibold text-white shadow-[0_10px_24px_-14px_rgba(113,52,217,.9)] transition hover:-translate-y-0.5 hover:bg-accent-dark">See dates <ArrowRight className="size-4" /></a>}{course.curriculumUrl ? <CurriculumRequest courseId={course.id} courseTitle={course.title} defaultCountry={phoneCountry} className={secondaryButton} /> : course.curriculum.length > 0 && <a href="#curriculum" className={secondaryButton}>View curriculum</a>}</div>
          </div>
          {!photo && (
            <div className="overflow-hidden rounded-[5px] border border-edge shadow-[0_24px_60px_-38px_rgba(25,17,46,.4)]">
              {course.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.imageUrl} alt="" className="aspect-[16/10] w-full object-cover" />
              ) : (
                <CourseArt seed={course.id} className="aspect-[16/10] w-full" />
              )}
            </div>
          )}
        </div>
        <div className="relative mx-auto grid max-w-[1200px] grid-cols-2 border-x border-t border-edge bg-white sm:grid-cols-4">
          <div className="flex items-center gap-3 border-b border-r border-edge px-4 py-4 sm:border-b-0 md:px-6"><ClockIcon className="size-5 shrink-0 text-accent" /><span><span className="block text-xs text-muted">Duration</span><span className="font-semibold text-ink">{course.durationWeeks ? `${course.durationWeeks} weeks` : "Flexible"}</span></span></div>
          <div className="flex items-center gap-3 border-b border-edge px-4 py-4 sm:border-b-0 sm:border-r md:px-6"><MonitorIcon className="size-5 shrink-0 text-accent" /><span><span className="block text-xs text-muted">Learning mode</span><span className="font-semibold text-ink">{deliveryModes || "Live classes"}</span></span></div>
          <div className="flex items-center gap-3 border-r border-edge px-4 py-4 md:px-6"><CardIcon className="size-5 shrink-0 text-accent" /><span><span className="block text-xs text-muted">Payment</span><span className="font-semibold text-ink">{cohorts.some((cohort) => cohort.depositPercent) ? "Deposit available" : "Secure checkout"}</span></span></div>
          <div className="flex items-center gap-3 px-4 py-4 md:px-6"><AwardIcon className="size-5 shrink-0 text-accent" /><span><span className="block text-xs text-muted">Credential</span><span className="font-semibold text-ink">{course.certificateEnabled ? "Verified certificate" : "Practical outcomes"}</span></span></div>
        </div>
      </section>

      <nav aria-label="Course sections" className="sticky top-[68px] z-20 border-y border-edge bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto px-5 sm:px-8">{courseNav.map((item) => <a key={item.href} href={item.href} className="shrink-0 border-b-2 border-transparent px-3 py-3.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent">{item.label}</a>)}</div></nav>

      <div className="mx-auto grid max-w-[1200px] items-start gap-10 px-5 py-12 sm:px-8 md:py-16 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-10">
          {course.description && (
            <section id="overview" className="scroll-mt-36 flex flex-col gap-4">
              <div><p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Course overview</p><h2 className="mt-2 font-display text-2xl font-bold text-ink">What this course is designed to do</h2></div>
              <Markdown>{course.description}</Markdown>
            </section>
          )}
          {course.outcomes.length > 0 && (
            <section id="outcomes" className="scroll-mt-36 rounded-[5px] border border-edge bg-white p-6 md:p-7">
              <h2 className="font-display text-2xl font-bold text-ink">What you&apos;ll be able to do</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex gap-2.5 text-[15px] leading-relaxed text-body">
                    <CheckIcon className="mt-0.5 size-5 shrink-0 text-accent" /> {o}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="grid gap-4 sm:grid-cols-3">
            {[{ icon: UsersIcon, title: "Hands-on learning", text: "Practise each concept in class and apply it to work you can show." }, { icon: MonitorIcon, title: "Live instructor support", text: "Ask questions, get unstuck and learn with feedback in real time." }, { icon: CardIcon, title: "Flexible ways to pay", text: cohorts.some((cohort) => cohort.depositPercent) ? "Reserve your place with a deposit and pay the balance later." : "Pay securely online or use the available transfer option." }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-[5px] border border-edge bg-panel p-5"><Icon className="size-5 text-accent" /><h3 className="mt-4 font-display text-lg font-bold text-ink">{title}</h3><p className="mt-1.5 text-sm leading-6 text-muted">{text}</p></div>)}
          </section>
          {course.certificateEnabled && <section className="flex items-start gap-4 rounded-[5px] border border-accent-muted/40 bg-accent-soft/40 p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[5px] bg-white text-accent shadow-sm"><AwardIcon className="size-6" /></span>
            <div><h2 className="font-display text-xl font-bold text-ink">Earn a verified certificate</h2><p className="mt-1 text-[15px] leading-6 text-muted">Complete the course with at least {course.certificateMinAttendance}% attendance, {course.certificateMinAssignments}% of assignments submitted, and a {course.certificateMinScore}% average score. Your certificate includes a public verification link and QR code.</p></div>
          </section>}
          {course.curriculum.length > 0 && (
            <section id="curriculum" className="scroll-mt-36 flex flex-col gap-5">
              <div><p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">Curriculum</p><h2 className="mt-2 font-display text-2xl font-bold text-ink">What you&apos;ll learn, week by week</h2></div>
              <ol className="divide-y divide-line border-y border-line">
                {course.curriculum.map((module, index) => <li key={`${module.title}-${index}`} className="grid gap-3 py-5 sm:grid-cols-[42px_1fr]"><span className="font-mono text-sm font-semibold text-accent">{String(index + 1).padStart(2, "0")}</span><div><h3 className="font-display text-lg font-bold text-ink">{module.title}</h3>{module.summary && <p className="mt-1 text-[15px] leading-6 text-muted">{module.summary}</p>}</div></li>)}
              </ol>
            </section>
          )}
          {(course.portfolioProjects.length > 0 || course.jobRoles.length > 0) && (
            <section className="grid gap-5 sm:grid-cols-2">
              {course.portfolioProjects.length > 0 && <div className="rounded-[5px] border border-edge bg-white p-6"><h2 className="font-display text-xl font-bold text-ink">Portfolio projects</h2><ul className="mt-4 space-y-3">{course.portfolioProjects.map((project) => <li key={project} className="flex gap-2.5 text-[15px] text-body"><CheckIcon className="mt-0.5 size-5 shrink-0 text-cyan-ink" />{project}</li>)}</ul></div>}
              {course.jobRoles.length > 0 && <div className="rounded-[5px] border border-edge bg-white p-6"><h2 className="font-display text-xl font-bold text-ink">Roles this supports</h2><div className="mt-4 flex flex-wrap gap-2">{course.jobRoles.map((role) => <Badge key={role} tone="accent">{role}</Badge>)}</div></div>}
            </section>
          )}
          {instructors.length > 0 && (
            <section className="flex flex-col gap-5">
              <h2 className="font-display text-2xl font-bold text-ink">Your {instructors.length === 1 ? "instructor" : "instructors"}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {instructors.map((i) => (
                  <div key={i.id} className="flex gap-4 rounded-[14px] border border-edge bg-white p-5">
                    <Avatar name={i.name} src={i.avatarUrl} size="lg" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="font-display text-lg font-bold text-ink">{i.name}</p>
                      {i.bio && <p className="text-sm leading-relaxed text-muted">{i.bio}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside id="cohorts" className="scroll-mt-36 flex flex-col gap-4 lg:sticky lg:top-36">
          <h2 className="font-display text-xl font-bold text-ink">Choose a cohort</h2>
          {cancelled && <Notice tone="amber">Payment was cancelled, so you haven&apos;t been charged. You can try again whenever you&apos;re ready.</Notice>}
          {cohorts.length === 0 && (
            <div className="rounded-[5px] border border-dashed border-edge-strong bg-panel p-6 text-[15px] text-muted">
              No cohorts are scheduled right now.{settings.supportEmail && <> Email <a href={`mailto:${settings.supportEmail}`} className="font-semibold text-accent">{settings.supportEmail}</a> to hear about the next one.</>}
            </div>
          )}
          {cohorts.map((cohort) => {
            const enrolled = myCohortIds.has(cohort.id);
            return (
              <div key={cohort.id} id={`cohort-${cohort.id}`} className="flex scroll-mt-36 flex-col gap-4 rounded-[5px] border border-edge bg-white p-5 transition hover:border-accent-muted hover:shadow-[0_18px_40px_-30px_rgba(25,17,46,.4)] target:border-accent target:ring-2 target:ring-accent/20 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <p className="font-display text-lg font-bold text-ink">{cohort.name}</p>
                    <p className="text-sm text-muted">
                      {cohort.startDate ? `${formatDateOnly(cohort.startDate)}${cohort.endDate ? ` – ${formatDateOnly(cohort.endDate)}` : ""}` : "Dates to be confirmed"}
                    </p>
                  </div>
                  <ModeBadge mode={cohort.deliveryMode} />
                </div>
                {(cohort.schedule || cohort.venue) && (
                  <ul className="flex flex-col gap-1.5 text-sm text-body">
                    {cohort.schedule && <li className="flex gap-2"><ClockIcon className="mt-0.5 size-4 shrink-0 text-muted" /> {cohort.schedule}</li>}
                    {cohort.venue && cohort.deliveryMode !== "virtual" && <li className="flex gap-2"><PinIcon className="mt-0.5 size-4 shrink-0 text-muted" /> {cohort.venue}</li>}
                  </ul>
                )}
                {cohort.seatsLeft !== null && !cohort.full && cohort.seatsLeft <= 5 && <Badge tone="cyan" className="w-fit">Only {cohort.seatsLeft} seats left</Badge>}
                <div className="border-t border-line pt-4">
                  {enrolled ? (
                    <Link href={`/dashboard/cohorts/${cohort.id}`} className="flex h-11 w-fit items-center rounded-lg bg-emerald-700 px-5 text-[15px] font-semibold text-white hover:bg-emerald-800">You&apos;re enrolled: go to class</Link>
                  ) : cohort.full ? (
                    <p className="text-[15px] font-semibold text-muted">This cohort is full.</p>
                  ) : !cohort.enrollmentOpen ? (
                    <p className="text-[15px] font-semibold text-muted">Enrolment is closed.</p>
                  ) : (
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <CohortPrice cohort={cohort} currencies={visitor.currencies} graduatesOf={graduatesOf} />
                      <Link href={`/enroll?cohort=${cohort.id}`} className="inline-flex h-11 items-center gap-2 rounded-[5px] bg-accent px-5 text-[15px] font-semibold text-white hover:bg-accent-dark">Enrol now <ArrowRight className="size-4" /></Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </aside>
      </div>
    </>
  );
}

function CohortPrice({ cohort, currencies, graduatesOf }: { cohort: Cohort; currencies: string[]; graduatesOf: string[] }) {
  if (isFree(cohort)) return <p className="font-display text-2xl font-bold text-emerald-700">Free</p>;
  const currency = [...currencies, ...cohortCurrencies(cohort)].find((c) => (cohort.prices[c] ?? 0) > 0 || (cohort.registrationFees[c] ?? 0) > 0);
  if (!currency) return null;
  const fee = cohort.registrationFees[currency] ?? 0;
  return (
    <div>
      <p className="font-display text-2xl font-bold tracking-tight text-ink">{formatMoney(cohort.prices[currency] ?? 0, currency)}</p>
      {fee > 0 && <p className="text-[13px] text-muted">+ {formatMoney(fee, currency)} registration fee</p>}
      {cohort.depositPercent && <p className="text-[13px] text-muted">or {cohort.depositPercent}% deposit to start</p>}
      {cohort.graduatesFree && <p className="text-[13px] font-semibold text-emerald-700">{graduatesOf.length ? `Free for graduates of ${graduatesOf.join(" or ")}` : "Free for academy graduates"}</p>}
    </div>
  );
}
