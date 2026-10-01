import Link from "next/link";
import { ProductShowcase } from "@/components/site/product-showcase";
import { HowItWorks } from "@/components/site/how-it-works";
import Image from "next/image";
import { ArrowRight, AwardIcon, BuildingIcon, CheckIcon, MessageIcon, MonitorIcon, PhoneIcon, SparkIcon, SwapIcon, VideoIcon } from "@/components/icons";
import { MarkMotif } from "@/components/site/page-hero";
import { CourseCard } from "@/components/site/course-card";
import { ModeBadge } from "@/components/ui";
import { isFree, withCohorts } from "@/lib/catalog";
import { getNextIntake, getPublishedCourses, getSettings, getUpcomingCohorts, seatsTaken } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { absoluteUrl, jsonLd } from "@/lib/site";
import { MODE_LABEL } from "@/lib/utils";
import { visitorCurrencies } from "@/lib/visitor";
import { pageMetadata, seoConfig } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  return pageMetadata(seo, { absoluteTitle: seo.homeTitle || seo.siteName, description: seo.homeDescription, path: "/" });
}

function SectionHeading({ eyebrow, title, subtitle, align = "center" }: { eyebrow?: string; title: string; subtitle?: string; align?: "center" | "left" }) {
  return (
    <div className={`flex flex-col gap-3.5 ${align === "center" ? "items-center text-center" : ""}`}>
      {eyebrow && <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent md:text-[13px]">{eyebrow}</p>}
      <h2 className="max-w-[760px] font-display text-3xl font-bold tracking-tight text-ink md:text-[44px] md:leading-[1.1]">{title}</h2>
      {subtitle && <p className="max-w-[640px] text-lg text-muted md:text-[19px]">{subtitle}</p>}
    </div>
  );
}

const FORMATS = [
  {
    icon: MonitorIcon, tone: "bg-accent-soft text-accent", title: "Live online",
    text: "Interactive classes over Zoom, Google Meet or Teams, taught live by working practitioners.",
    points: ["Join from anywhere", "Recordings after class", "Breakout pair-work"],
  },
  {
    icon: BuildingIcon, tone: "bg-cyan-soft text-cyan-ink", title: "In person",
    text: "Hands-on live classes in our training space, with instructors beside you while you build.",
    points: ["Small groups", "Lab machines available", "Networking with peers"],
  },
  {
    icon: SwapIcon, tone: "bg-navy text-white", title: "Hybrid",
    text: "Weekday evenings online and weekend labs in person: the flexibility of both formats.",
    points: ["One timetable", "Switch when you need to", "Same instructors"],
  },
];

const STEPS = [
  { title: "Choose a cohort", text: "Pick a course and the start date and format that fit your schedule." },
  { title: "Pay securely", text: "Pay online by card or mobile money, in the currency that suits you." },
  { title: "Learn and build", text: "Attend classes, get reminders before each one, and submit real assignments." },
  { title: "Get feedback", text: "Instructors grade your work with written feedback, so you know exactly how to improve." },
];

const PATHS = ["Data Analytics", "Business Intelligence", "SQL", "Data Engineering", "Digital Skills"];

export default async function HomePage() {
  const [settings, courses, upcoming] = await Promise.all([getSettings(), getPublishedCourses(), getUpcomingCohorts(6)]);
  const summaries = await withCohorts(courses.filter((c) => c.kind === "course"));
  const featured = (summaries.some((c) => c.featured) ? summaries.filter((c) => c.featured) : summaries).slice(0, 3);
  const taken = await seatsTaken(upcoming.map((u) => u.cohort.id));
  const { currencies } = await visitorCurrencies(settings);
  const heroPhoto = settings.heroImageUrl ?? "/images/home-hero-team.webp";
  // Five photos for the hero's curve: the Settings hero photo in the middle, then the bundled photos and course covers.
  const pool = [...new Set([heroPhoto, "/images/how-it-works-classroom.webp", "/images/academy-instructor-support.webp", "/images/enrol-classroom.webp", "/images/home-hero-team.webp", ...summaries.flatMap((c) => (c.imageUrl ? [c.imageUrl] : []))])];
  const pick = (n: number) => pool[n % pool.length];
  // With only four distinct photos, the far-right slot repeats a classroom photo rather than the centre one.
  const gallery = [pick(3), pick(1), pick(0), pick(2), pool.length > 4 ? pool[4] : pick(1)];
  const next = await getNextIntake();
  const nextStart = next?.cohort.startDate ? new Date(`${next.cohort.startDate}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }) : null;
  const nextSeats = next?.seatsLeft ?? null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: settings.siteName,
    url: absoluteUrl("/"),
    description: settings.seo?.homeDescription || settings.tagline || undefined,
    email: settings.supportEmail || undefined,
    telephone: settings.phone || undefined,
    address: settings.address || undefined,
    logo: settings.logoUrl ? absoluteUrl(settings.logoUrl) : undefined,
    sameAs: settings.seo?.socialProfiles?.length ? settings.seo.socialProfiles : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />

      {/* Hero: centred text above a curved row of photos, on a soft lavender wash with the brand mark drifting at the edges. */}
      <section data-under-header className="relative isolate overflow-hidden bg-white">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_12%_0%,rgba(79,63,215,.16),transparent_62%),radial-gradient(820px_500px_at_92%_8%,rgba(49,196,240,.18),transparent_60%),linear-gradient(180deg,#f1efff_0%,#f8f7fd_52%,#ffffff_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(79,63,215,.18)_1px,transparent_1.2px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_55%_45%_at_50%_28%,#000_15%,transparent_75%)]" />
          <MarkMotif tone="light" className="hero-motif absolute -left-28 top-24 size-[420px] max-lg:hidden" />
          <MarkMotif tone="light" className="hero-motif absolute -right-24 -top-6 size-[360px] [animation-delay:-7s] max-md:hidden" />
        </div>
        {/* Small notes floating either side of the headline on wide screens. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 mx-auto hidden h-[560px] max-w-[1320px] xl:block">
          <span className="showcase-bob absolute left-6 top-[430px] flex items-center gap-2.5 rounded-[5px] bg-white px-3.5 py-2.5 text-[13px] font-bold text-ink shadow-[0_18px_40px_-18px_rgba(24,19,64,.45)] ring-1 ring-edge"><span className="flex size-8 items-center justify-center rounded-[5px] bg-accent-soft text-accent"><VideoIcon className="size-4" /></span>Live classes, online or in person</span>
          <span className="showcase-bob absolute right-6 top-[395px] flex items-center gap-2.5 rounded-[5px] bg-white px-3.5 py-2.5 text-[13px] font-bold text-ink shadow-[0_18px_40px_-18px_rgba(24,19,64,.45)] ring-1 ring-edge [animation-delay:1.2s]"><span className="flex size-8 items-center justify-center rounded-[5px] bg-cyan-soft text-cyan-ink"><AwardIcon className="size-4" /></span>Verified certificates</span>
          <span className="showcase-bob absolute right-24 top-[495px] flex items-center gap-2.5 rounded-[5px] bg-white px-3.5 py-2.5 text-[13px] font-bold text-ink shadow-[0_18px_40px_-18px_rgba(24,19,64,.45)] ring-1 ring-edge [animation-delay:2.4s]"><span className="flex size-8 items-center justify-center rounded-[5px] bg-emerald-50 text-emerald-700"><CheckIcon className="size-4" /></span>Feedback on real projects</span>
        </div>
        <div className="mx-auto flex max-w-[1200px] flex-col items-center px-5 pt-14 text-center sm:px-8 md:pt-20">
          {/* The live next start date when a cohort is open, otherwise the eyebrow text from Settings. */}
          {next ? (
            <Link href={`/enroll?cohort=${next.cohort.id}`} className="hero-rise group flex items-center gap-2.5 rounded-full border border-edge bg-white/80 py-1.5 pl-2 pr-3.5 text-sm font-medium text-body transition hover:border-accent-muted hover:bg-white">
              <span className="relative flex size-6 items-center justify-center rounded-full bg-white shadow-sm" aria-hidden="true">
                <span className="absolute size-2 animate-ping rounded-full bg-accent/40 motion-reduce:hidden" />
                <span className="relative size-2 rounded-full bg-accent" />
              </span>
              Next intake starts <span className="font-semibold text-ink">{nextStart ?? "soon"}</span>
              <ArrowRight className="size-3.5 text-accent transition group-hover:translate-x-0.5" />
            </Link>
          ) : settings.heroEyebrow && (
            <p className="hero-rise flex items-center gap-2 rounded-full border border-edge bg-white/80 px-3.5 py-1.5 text-sm font-medium text-body">
              <CheckIcon className="size-4 text-accent" /> {settings.heroEyebrow}
            </p>
          )}
          <h1 style={{ animationDelay: "100ms" }} className="hero-rise mt-6 max-w-[920px] text-balance font-display text-[40px] font-extrabold leading-[1.05] tracking-[-1.5px] text-ink sm:text-[54px] lg:text-[68px] lg:tracking-[-2.5px]">
            {/* Words wrapped in *asterisks* in Settings are highlighted. */}
            {(settings.heroTitle || settings.siteName).split(/\*([^*]+)\*/).map((part, i) => (i % 2 ? <span key={i} className="bg-[linear-gradient(100deg,#4f3fd7_0%,#6e61e3_45%,#1fa9d6_100%)] bg-clip-text text-transparent">{part}</span> : part))}
          </h1>
          {settings.heroSubtitle && <p style={{ animationDelay: "180ms" }} className="hero-rise mt-5 max-w-[620px] text-pretty text-lg leading-relaxed text-muted md:text-[19px]">{settings.heroSubtitle}</p>}
          <div style={{ animationDelay: "260ms" }} className="hero-rise mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/courses" className="flex h-13 items-center gap-2 rounded-full bg-ink px-7 text-base font-semibold text-white shadow-[0_14px_30px_-14px_rgba(24,19,64,.8)] transition hover:-translate-y-0.5 hover:bg-accent">
              Browse courses <ArrowRight className="size-[18px]" />
            </Link>
            <a href="#formats" className="flex h-13 items-center rounded-full border-[1.5px] border-ink/80 bg-white/70 px-7 text-base font-semibold text-ink transition hover:border-accent hover:text-accent">How we teach</a>
          </div>
        </div>

        {/* The gallery is cut by two large elliptical edges, creating one continuous curve across every photo. */}
        <div aria-hidden="true" className="hero-gallery-curve relative mb-16 mt-10 [perspective:1200px] sm:mb-20 sm:mt-12 md:mb-24 md:mt-14" style={{ maskImage: "linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)", WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)" }}>
          <div className="flex items-start justify-center gap-3 px-3 [transform-style:preserve-3d] sm:gap-4 md:gap-5">
            {gallery.map((src, i) => {
              const offset = i - 2;
              return (
                <div
                  key={`${src}-${i}`}
                  className={`hero-arc-tile relative aspect-[4/3] w-[68vw] max-w-[340px] shrink-0 overflow-hidden rounded-[5px] border border-white/80 bg-panel shadow-sm sm:w-[38vw] md:w-[24vw] ${Math.abs(offset) === 2 ? "hidden md:block" : ""}`}
                  style={{ "--arc": offset, "--depth": Math.abs(offset) } as React.CSSProperties}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading={offset === 0 ? "eager" : "lazy"} fetchPriority={offset === 0 ? "high" : undefined} className="size-full object-cover transition-transform duration-700" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-ink/[.06]" />
                </div>
              );
            })}
          </div>
        </div>

        {settings.stats.length > 0 && (
          <dl className="mx-auto grid max-w-[900px] grid-cols-2 gap-x-8 gap-y-6 px-5 pb-16 pt-4 text-center sm:grid-cols-4 sm:px-8 md:pb-20">
            {settings.stats.map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse gap-1">
                <dt className="text-sm text-muted">{stat.label}</dt>
                <dd className="font-display text-3xl font-bold tracking-tight text-ink">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {!settings.stats.length && <div className="pb-16 md:pb-20" />}
      </section>

      {/* Fast course discovery */}
      <section aria-label="Popular learning paths" className="border-y border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <p className="flex shrink-0 items-center gap-2 font-display text-sm font-bold text-ink"><SparkIcon className="size-4 text-accent" /> What do you want to learn?</p>
          <div className="flex flex-wrap gap-2">
            {PATHS.map((path) => <Link key={path} href={`/courses?q=${encodeURIComponent(path)}`} className="rounded-full border border-edge bg-panel px-4 py-2 text-sm font-semibold text-body transition hover:border-accent-muted hover:bg-accent-soft hover:text-accent">{path}</Link>)}
          </div>
          <Link href="/courses" className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-accent hover:text-accent-dark">View all <ArrowRight className="size-4" /></Link>
        </div>
      </section>

      {/* Formats */}
      <section id="formats" className="scroll-mt-20 border-t border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-20 sm:px-8 md:py-24">
          <SectionHeading eyebrow="How we teach" title="Online, in person, or both" subtitle="Every cohort has a clear timetable. Each class is either live online or in our training space, and you always know which." />
          <div className="grid gap-5 md:grid-cols-3">
            {FORMATS.map(({ icon: Icon, tone, title, text, points }) => (
              <div key={title} className="group flex flex-col gap-4 rounded-[5px] border border-edge bg-panel p-6 transition hover:-translate-y-1 hover:border-accent-muted hover:bg-white hover:shadow-[0_18px_45px_-24px_rgba(24,19,64,.35)] md:p-7">
                <span className={`flex size-12 items-center justify-center rounded-[5px] ${tone}`}><Icon className="size-6" /></span>
                <h3 className="font-display text-xl font-bold text-ink">{title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{text}</p>
                <ul className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
                  {points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-[15px] text-body"><CheckIcon className="size-4 text-accent" /> {p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instructor-led learning */}
      <section className="border-t border-line bg-panel">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-20 sm:px-8 md:py-24 lg:grid-cols-[1.08fr_.92fr] lg:gap-16">
          <div className="relative overflow-hidden rounded-[5px] border border-edge bg-white p-2 shadow-[0_20px_55px_-36px_rgba(24,19,64,.45)]">
            <Image src="/images/academy-instructor-support.webp" width={1440} height={960} sizes="(max-width: 1024px) 100vw, 52vw" alt="An instructor supporting Black African and White adult learners during a hands-on computer workshop" className="aspect-[3/2] w-full rounded-[3px] object-cover" />
          </div>
          <div className="flex flex-col gap-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-[1.5px] text-accent">Human support</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-[42px] md:leading-[1.1]">Learn with people, not alone with a playlist</h2>
            <p className="text-lg leading-relaxed text-muted">Your instructor sees where you are stuck, explains the difficult part, and gives you feedback on the work you actually produce.</p>
            <ul className="grid gap-3 text-[15px] text-body sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {["Ask questions in every live class", "Build alongside your cohort", "Get feedback you can act on", "Leave with portfolio-ready work"].map((item) => <li key={item} className="flex items-start gap-2.5"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><CheckIcon className="size-3.5" /></span>{item}</li>)}
            </ul>
            <Link href="/courses" className="mt-2 flex h-11 w-fit items-center gap-2 rounded-[5px] bg-accent px-5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-dark">Find your course <ArrowRight className="size-4" /></Link>
          </div>
        </div>
      </section>

      {/* Courses */}
      {featured.length > 0 && (
        <section id="courses" className="scroll-mt-20 border-t border-line">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-20 sm:px-8 md:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading align="left" eyebrow="Courses" title="Career-ready skills, taught by practitioners" />
              <Link href="/courses" className="flex h-11 items-center gap-2 rounded-[5px] border border-edge-strong bg-white px-5 font-semibold text-ink hover:bg-page">All courses <ArrowRight className="size-4" /></Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((course) => <CourseCard key={course.id} course={course} currencies={currencies} />)}
            </div>
          </div>
        </section>
      )}

      {/* Internship programme: a compact banner. */}
      <section aria-labelledby="internship-heading" className="border-t border-line bg-white">
        <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 md:py-20">
          <div className="relative flex flex-col gap-7 overflow-hidden rounded-[5px] bg-[linear-gradient(120deg,#211a5c_0%,#3d2fb8_100%)] px-7 py-9 text-white md:px-12 md:py-10 lg:flex-row lg:items-center lg:justify-between">
            <div aria-hidden="true" className="absolute -right-20 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col gap-3">
              <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-cyan-light">Internship programme</p>
              <h2 id="internship-heading" className="font-display text-[28px] font-bold leading-tight tracking-tight md:text-[34px]">Get real-world experience</h2>
              <p className="max-w-[560px] text-white/75">Supervised, practical projects you can show employers.</p>
              <ul className="flex flex-wrap gap-2 pt-1">
                {["Real projects", "Supervised by practitioners", "Free for our graduates"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[.08] px-3 py-1.5 text-[13px] font-medium text-white/90"><CheckIcon className="size-3.5 text-cyan-light" />{item}</li>
                ))}
              </ul>
            </div>
            <div className="relative flex shrink-0 flex-wrap gap-3">
              <Link href="/internships/apply" className="flex h-12 items-center gap-2 rounded-[5px] bg-white px-6 font-semibold text-accent transition hover:-translate-y-0.5 hover:bg-accent-soft">Apply now <ArrowRight className="size-4" /></Link>
              <Link href="/internships" className="flex h-12 items-center rounded-[5px] border-[1.5px] border-white/40 px-6 font-semibold text-white transition hover:border-white hover:bg-white/10">See programmes</Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works: the steps beside an animated picture of each one. */}
      <section id="how" className="scroll-mt-20 border-t border-line bg-panel">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-20 sm:px-8 md:py-28">
          <SectionHeading align="left" eyebrow="How it works" title="From sign-up to your first piece of feedback" subtitle="Four steps, and you're learning live with your cohort." />
          <HowItWorks steps={STEPS} />
        </div>
      </section>

      {/* The platform, shown off: students' and instructors' views, animated. */}
      <section id="platform" className="scroll-mt-20 border-t border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-20 sm:px-8 md:py-24">
          <SectionHeading eyebrow="Your learning space" title="Everything for your cohort, in one place" subtitle="Live classes, lessons, practice and feedback for students. Attendance, grading and announcements for instructors." />
          <ProductShowcase />
        </div>
      </section>

      {/* Upcoming cohorts */}
      {upcoming.length > 0 && (
        <section className="border-t border-line">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-20 sm:px-8 md:py-24">
            <SectionHeading align="left" eyebrow="Upcoming cohorts" title="Next start dates" />
            <ul className="flex flex-col divide-y divide-edge overflow-hidden rounded-[5px] border border-edge bg-white">
              {upcoming.map(({ cohort, course }) => {
                const left = cohort.capacity ? Math.max(0, cohort.capacity - (taken.get(cohort.id) ?? 0)) : null;
                const priceCurrency = [...currencies, ...Object.keys(cohort.prices)].find((c) => (cohort.prices[c] ?? 0) > 0);
                const price = priceCurrency ? cohort.prices[priceCurrency] : undefined;
                const [y, m, d] = (cohort.startDate ?? "").split("-");
                const month = cohort.startDate ? new Date(Date.UTC(+y, +m - 1, +d)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) : "TBC";
                return (
                  <li key={cohort.id}>
                    <Link href={`/courses/${course.slug}#cohort-${cohort.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5 hover:bg-panel md:flex-nowrap md:px-6">
                      <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-[5px] bg-accent-soft text-accent">
                        <span className="font-display text-2xl font-bold leading-none">{cohort.startDate ? Number(d) : "–"}</span>
                        <span className="font-mono text-[11px] uppercase tracking-wider">{month}</span>
                      </div>
                      <div className="flex min-w-0 grow flex-col gap-1">
                        <p className="font-display text-lg font-bold text-ink">{course.title}</p>
                        <p className="text-sm text-muted">{cohort.name}{cohort.schedule ? ` · ${cohort.schedule}` : ""}</p>
                      </div>
                      <ModeBadge mode={cohort.deliveryMode} />
                      <p className="w-28 text-sm text-muted">{left === null ? "Open" : left === 0 ? "Full" : `${left} seats left`}</p>
                      <p className="w-24 font-display text-lg font-bold text-ink md:text-right">
                        {isFree(cohort) ? "Free" : price && priceCurrency ? formatMoney(price, priceCurrency) : ""}
                      </p>
                      <ArrowRight className="hidden size-5 text-accent md:block" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted">Your seat is confirmed as soon as payment completes.</p>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {settings.testimonials.length > 0 && (
        <section className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-20 sm:px-8 md:py-24">
            <SectionHeading eyebrow="Student stories" title="What our students say" />
            <div className="grid gap-5 md:grid-cols-3">
              {settings.testimonials.map((t) => (
                <figure key={t.name} className="relative flex flex-col gap-5 overflow-hidden rounded-[5px] border border-edge bg-panel p-6 transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_45px_-24px_rgba(24,19,64,.3)] md:p-7">
                  <span aria-hidden="true" className="absolute right-5 top-1 font-display text-7xl font-bold leading-none text-accent/10">&ldquo;</span>
                  <div className="flex gap-1 text-accent" aria-label="5 out of 5 stars">{[0, 1, 2, 3, 4].map((i) => <span key={i} aria-hidden="true">★</span>)}</div>
                  <blockquote className="relative text-[16px] leading-relaxed text-body">&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-auto flex items-center gap-3 border-t border-line pt-4">
                    <span className="flex size-10 items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-white">{t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>
                    <span className="flex flex-col">
                      <span className="font-semibold text-ink">{t.name}</span>
                      <span className="text-sm text-muted">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {settings.faqs.length > 0 && (
        <section id="faq" className="scroll-mt-20 border-t border-line">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-20 sm:px-8 md:py-24 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <div className="flex flex-col gap-4">
              <SectionHeading align="left" eyebrow="FAQ" title="Questions, answered" />
              {settings.supportEmail && <p className="text-[15px] text-muted">Still unsure? Email <a href={`mailto:${settings.supportEmail}`} className="font-semibold text-accent hover:text-accent-dark">{settings.supportEmail}</a>.</p>}
            </div>
            <div className="flex flex-col divide-y divide-edge rounded-[5px] border border-edge bg-white">
              {settings.faqs.map((f) => (
                <details key={f.question} className="group px-5 md:px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-[17px] font-bold text-ink">
                    {f.question}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-page text-accent transition group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="pb-5 text-[15px] leading-relaxed text-muted">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Closing: the real next start date and a person to talk to */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-20 sm:px-8 md:py-28 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
          <div className="flex flex-col gap-6">
            <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent md:text-[13px]">Next intake</p>
            {next ? (
              <>
                <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-[-1.5px] text-ink md:text-[64px]">
                  The next class starts on <span className="text-accent">{nextStart ?? "a date we’ll confirm soon"}</span>.
                </h2>
                <p className="text-lg text-muted">
                  <Link href={`/courses/${next.course.slug}`} className="font-semibold text-ink underline decoration-edge-strong underline-offset-4 hover:decoration-accent">{next.course.title}</Link>
                  {" · "}{MODE_LABEL[next.cohort.deliveryMode]}
                  {nextSeats !== null && nextSeats <= 10 && <> · <span className="font-semibold text-ink">{nextSeats === 1 ? "1 seat" : `${nextSeats} seats`} left</span></>}
                </p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
                  <Link href={`/enroll?cohort=${next.cohort.id}`} className="inline-flex h-12 items-center gap-2 rounded-[5px] bg-ink px-6 font-semibold text-white transition hover:bg-accent">Save my place <ArrowRight className="size-4" /></Link>
                  <Link href="/courses" className="font-semibold text-ink underline decoration-edge-strong underline-offset-4 hover:decoration-accent">Or compare all courses</Link>
                </div>
              </>
            ) : (
              <h2 className="font-display text-4xl font-bold leading-[1.05] tracking-[-1.5px] text-ink md:text-[64px]">New cohorts are being scheduled.</h2>
            )}
          </div>
          {(settings.supportEmail || settings.phone) && (
            <div className="flex flex-col gap-5 border-t border-line pt-8 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-2">
              <p className="font-display text-xl font-bold text-ink">Not sure which course is right for you?</p>
              <p className="leading-relaxed text-muted">Tell us where you are now and what you want to do next. Someone from the team will reply, usually within a working day.</p>
              <ul className="flex flex-col gap-3 text-[15px]">
                {settings.supportEmail && <li><a href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent("Help choosing a course")}`} className="inline-flex items-center gap-2.5 font-semibold text-ink hover:text-accent"><MessageIcon className="size-5 text-accent" />{settings.supportEmail}</a></li>}
                {settings.phone && <li><a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2.5 font-semibold text-ink hover:text-accent"><PhoneIcon className="size-5 text-accent" />{settings.phone}</a></li>}
              </ul>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
