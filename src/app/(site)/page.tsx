import Link from "next/link";
import { ProductShowcase } from "@/components/site/product-showcase";
import { HowItWorks } from "@/components/site/how-it-works";
import Image from "next/image";
import { ArrowRight, BuildingIcon, CheckIcon, MessageIcon, MonitorIcon, PhoneIcon, SparkIcon, SwapIcon, VideoIcon } from "@/components/icons";
import { MarkMotif } from "@/components/site/page-hero";
import { ScrambleText } from "@/components/site/scramble-text";
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
import { ratingsFor } from "@/lib/reviews";
import { and, asc, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { freeClasses } from "@/db/schema";
import { formatSessionRange } from "@/lib/time";
import { publishedProjects } from "@/lib/showcase-data";
import { CourseArt } from "@/components/site/course-art";

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
  const ratings = await ratingsFor(featured.map((c) => c.id));
  const taken = await seatsTaken(upcoming.map((u) => u.cohort.id));
  const { currencies } = await visitorCurrencies(settings);
  const next = await getNextIntake();
  const projects = await publishedProjects({ limit: 3 });
  // The next free class still taking sign-ups, for the "try it free" banner.
  const [freeClass] = await (await getDb()).select().from(freeClasses).where(and(eq(freeClasses.status, "open"), gt(freeClasses.startsAt, new Date()))).orderBy(asc(freeClasses.startsAt)).limit(1);
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

      {/* Hero: an inset indigo panel with faint line work behind centred text. The site header floats over its top edge. */}
      <section className="bg-white px-2 pt-2 sm:px-3 sm:pt-3">
        <div data-under-header className="relative isolate overflow-hidden rounded-[16px] bg-[#4f3fd7] text-white md:rounded-[24px]">
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            {/* A few long, faint lines across the panel, like a drafting sheet. */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-position:-1px_150px] [background-size:320px_240px] [mask-image:linear-gradient(180deg,#000_55%,transparent)]" />
            {/* Large thin rings off the top right, and a fan of lines sweeping in from the bottom left. */}
            <svg viewBox="0 0 800 800" fill="none" className="absolute -right-[260px] -top-[300px] size-[820px] max-md:-right-[220px] max-md:-top-[240px] max-md:size-[560px]">
              {[390, 320, 250, 180].map((r, i) => <circle key={r} cx="400" cy="400" r={r} stroke={`rgba(255,255,255,${0.13 - i * 0.025})`} strokeWidth="1" />)}
              <circle cx="400" cy="400" r="320" stroke="rgba(143,223,247,.4)" strokeWidth="1.2" strokeDasharray="2 10" />
            </svg>
            <svg viewBox="0 0 600 400" fill="none" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-[70%] w-[55%] max-md:hidden">
              {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M0 ${400 - i * 18} Q ${220 + i * 40} ${300 - i * 50} ${600} ${-40 + i * 70}`} stroke={`rgba(255,255,255,${0.1 - i * 0.015})`} strokeWidth="1" />)}
            </svg>
            <MarkMotif className="hero-motif absolute -right-16 bottom-0 size-[300px] opacity-40 [animation-delay:-7s] max-md:hidden" />
          </div>

          <div className="mx-auto flex max-w-[1200px] flex-col items-center px-5 pb-16 pt-12 text-center sm:px-8 md:pb-24 md:pt-20">
            {/* The live next start date when a cohort is open, otherwise the eyebrow text from Settings. */}
            {next ? (
              <Link href={`/enroll?cohort=${next.cohort.id}`} className="hero-rise group flex items-center gap-2.5 rounded-full bg-white/[.1] py-1.5 pl-2 pr-3.5 text-sm font-medium text-white/85 ring-1 ring-white/25 transition hover:bg-white/[.16]">
                <span className="relative flex size-6 items-center justify-center rounded-full bg-white" aria-hidden="true">
                  <span className="absolute size-2 animate-ping rounded-full bg-accent/40 motion-reduce:hidden" />
                  <span className="relative size-2 rounded-full bg-accent" />
                </span>
                Next intake starts <span className="font-semibold tabular-nums text-white"><ScrambleText text={nextStart ?? "soon"} delay={150} /></span>
                <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
              </Link>
            ) : settings.heroEyebrow && (
              <p className="hero-rise flex items-center gap-2 rounded-full bg-white/[.1] px-3.5 py-1.5 text-sm font-medium text-white/90 ring-1 ring-white/25">
                <CheckIcon className="size-4 text-cyan-light" /> {settings.heroEyebrow}
              </p>
            )}
            <h1 style={{ animationDelay: "100ms" }} className="hero-rise mt-6 max-w-[920px] text-balance font-display text-[40px] font-extrabold leading-[1.05] tracking-[-1.5px] sm:text-[54px] lg:text-[68px] lg:tracking-[-2.5px]">
              {/* Words wrapped in *asterisks* in Settings are highlighted. */}
              {(settings.heroTitle || settings.siteName).split(/\*([^*]+)\*/).map((part, i) => (i % 2 ? <span key={i} className="bg-[linear-gradient(100deg,#ffffff_0%,#bfe9fb_45%,#8fdff7_100%)] bg-clip-text text-transparent">{part}</span> : part))}
            </h1>
            {settings.heroSubtitle && <p style={{ animationDelay: "180ms" }} className="hero-rise mt-5 max-w-[620px] text-pretty text-lg leading-relaxed text-white/80 md:text-[19px]">{settings.heroSubtitle}</p>}
            <div style={{ animationDelay: "260ms" }} className="hero-rise mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/courses" className="flex h-13 items-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-[#4f3fd7] shadow-[0_14px_30px_-14px_rgba(0,0,0,.55)] transition hover:-translate-y-0.5 hover:bg-cyan-soft">
                Browse courses <ArrowRight className="size-[18px]" />
              </Link>
              <a href="#formats" className="flex h-13 items-center rounded-full px-7 text-base font-semibold text-white ring-[1.5px] ring-white/55 transition hover:bg-white/10 hover:ring-white">How we teach</a>
            </div>

            {/* Stats from Settings, as one segmented bar. */}
            {settings.stats.length > 0 && (
              <dl style={{ animationDelay: "340ms" }} className="hero-rise mt-12 grid w-full max-w-[560px] grid-cols-2 overflow-hidden rounded-[10px] bg-white/[.06] ring-1 ring-white/20 backdrop-blur-sm lg:flex lg:w-auto lg:max-w-none lg:rounded-full md:mt-14">
                {settings.stats.map((stat, i) => (
                  <div key={stat.label} className={`flex flex-col-reverse items-center gap-0.5 px-5 py-3 lg:flex-row-reverse lg:gap-3 lg:py-2.5 ${i > 0 ? "lg:border-l lg:border-white/20" : ""} ${i % 2 ? "border-l border-white/20" : ""} ${i > 1 ? "border-t border-white/20 lg:border-t-0" : ""}`}>
                    <dd className="font-display text-xl font-bold tabular-nums tracking-tight text-white lg:text-base"><ScrambleText text={stat.value} delay={450 + i * 120} /></dd>
                    <dt className="whitespace-nowrap text-xs text-white/70 lg:text-sm">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
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

      {/* Free class: a low-commitment first step, shown only when one is open. */}
      {freeClass && (
        <section aria-label="Free class" className="bg-white px-5 pt-14 sm:px-8 md:pt-20">
          <Link href={`/free-classes/${freeClass.slug}`} className="group mx-auto flex max-w-[1200px] flex-col gap-5 overflow-hidden rounded-[16px] bg-[#181340] p-6 text-white transition hover:-translate-y-0.5 sm:p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-cyan-light ring-1 ring-white/15"><VideoIcon className="size-5" /></span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-mono text-xs uppercase tracking-[1.5px] text-cyan-light">Free live class</p>
                <p className="font-display text-xl font-bold md:text-2xl">{freeClass.title}</p>
                <p className="text-[15px] text-white/70">{formatSessionRange(freeClass.startsAt, freeClass.endsAt, settings.timezone)} · {freeClass.mode === "virtual" ? "Live online" : freeClass.venue}</p>
              </div>
            </div>
            <span className="inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-full bg-white px-6 font-semibold text-[#4f3fd7] md:self-auto">Save my free place <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
          </Link>
        </section>
      )}

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
              {featured.map((course) => <CourseCard key={course.id} course={course} currencies={currencies} rating={ratings.get(course.id)} />)}
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

      {/* Student projects: graded work students chose to publish. */}
      {projects.length > 0 && (
        <section className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-20 sm:px-8 md:py-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading align="left" eyebrow="Student projects" title="Built by our students" subtitle="Real coursework, graded by instructors and published by the students who built it." />
              <Link href="/projects" className="flex items-center gap-1.5 font-bold text-accent hover:text-accent-dark">See all projects <ArrowRight className="size-4" /></Link>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {projects.map(({ project: p, studentName, courseTitle }) => (
                <Link key={p.id} href={`/projects/${p.slug}`} className="group flex flex-col overflow-hidden rounded-[12px] border border-edge bg-white transition hover:-translate-y-1 hover:border-accent-muted hover:shadow-[0_24px_50px_-30px_rgba(24,19,64,.45)]">
                  <div className="aspect-[16/10] overflow-hidden bg-panel">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <CourseArt seed={p.id} className="size-full" />}
                  </div>
                  <div className="flex flex-col gap-1.5 p-5">
                    {courseTitle && <p className="font-mono text-[11px] font-semibold uppercase tracking-[1.4px] text-accent">{courseTitle}</p>}
                    <h3 className="font-display text-lg font-bold leading-snug text-ink group-hover:text-accent">{p.title}</h3>
                    <p className="text-sm text-muted">by {studentName}</p>
                  </div>
                </Link>
              ))}
            </div>
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
