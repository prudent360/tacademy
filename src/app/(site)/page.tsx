import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BellIcon, BuildingIcon, CalendarIcon, CardIcon, CheckIcon, ClipboardIcon, MegaphoneIcon, MessageIcon, MonitorIcon, PhoneIcon, SparkIcon, SwapIcon } from "@/components/icons";
import { CourseCard } from "@/components/site/course-card";
import { ModeBadge } from "@/components/ui";
import { isFree, withCohorts } from "@/lib/catalog";
import { getNextIntake, getPublishedCourses, getSettings, getUpcomingCohorts, seatsTaken } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { absoluteUrl, jsonLd } from "@/lib/site";
import { MODE_LABEL } from "@/lib/utils";
import { visitorCurrencies } from "@/lib/visitor";

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
    text: "Hands-on sessions in our training space, with instructors beside you while you build.",
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
  { title: "Pay securely", text: "Pay by card with Stripe or Paystack, or with mobile money across Africa through pawaPay." },
  { title: "Learn and build", text: "Attend classes, get reminders before each one, and submit real assignments." },
  { title: "Get feedback", text: "Instructors grade your work with written feedback, so you know exactly how to improve." },
];

const FEATURES = [
  { icon: ClipboardIcon, title: "Assignments that matter", text: "Project-based tasks with clear deadlines. Upload files or share links, and resubmit when asked." },
  { icon: MessageIcon, title: "Written instructor feedback", text: "Every submission is reviewed and scored, with notes you can come back to." },
  { icon: BellIcon, title: "Reminders that arrive on time", text: "Email and in-app reminders the day before and an hour before each class, and before deadlines." },
  { icon: CalendarIcon, title: "Your timetable, synced", text: "Every class with its joining link or venue, one tap away from your calendar." },
  { icon: MegaphoneIcon, title: "Cohort announcements", text: "Updates from your instructors land in your inbox and your dashboard." },
  { icon: CardIcon, title: "Receipts and records", text: "Payment receipts, attendance and grades all kept in one place." },
];

const PATHS = ["Data Analytics", "Business Intelligence", "SQL", "Data Engineering", "Digital Skills"];

export default async function HomePage() {
  const [settings, courses, upcoming] = await Promise.all([getSettings(), getPublishedCourses(), getUpcomingCohorts(6)]);
  const summaries = await withCohorts(courses.filter((c) => c.kind === "course"));
  const featured = (summaries.some((c) => c.featured) ? summaries.filter((c) => c.featured) : summaries).slice(0, 3);
  const taken = await seatsTaken(upcoming.map((u) => u.cohort.id));
  const { currencies } = await visitorCurrencies(settings);
  const heroPhoto = settings.heroImageUrl ?? "/images/home-hero-team.webp";
  const next = await getNextIntake();
  const nextStart = next?.cohort.startDate ? new Date(`${next.cohort.startDate}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }) : null;
  const nextSeats = next?.seatsLeft ?? null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: settings.siteName,
    url: absoluteUrl("/"),
    description: settings.tagline || undefined,
    email: settings.supportEmail || undefined,
    address: settings.address || undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />

      {/* Hero */}
      <section data-dark-hero className="relative overflow-hidden bg-[linear-gradient(160deg,#19112e_0%,#221544_55%,#2b1a5c_100%)] text-white">
        {/* Large screens: the photo starts just left of the page's centre line, so on wide monitors it stays
            beside the text rather than sliding behind it, and fades into the background on its left and bottom. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-[calc(50%-80px)] right-0 hidden overflow-hidden lg:block"
          style={{ maskImage: "linear-gradient(90deg, transparent 0%, transparent 14%, #000 46%), linear-gradient(180deg, #000 70%, transparent 100%)", maskComposite: "intersect", WebkitMaskImage: "linear-gradient(90deg, transparent 0%, transparent 14%, #000 46%), linear-gradient(180deg, #000 70%, transparent 100%)", WebkitMaskComposite: "source-in" }}
        >
          {/* Taller than the hero and anchored to the bottom, so the backdrop banner above the faces is cropped off. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroPhoto} alt="" fetchPriority="high" className="absolute inset-x-0 bottom-0 h-[120%] w-full object-cover object-center" />
          {/* Tints the photo towards the brand, and darkens the top so nothing shows through the menu. */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(25,17,46,.88)_0%,rgba(25,17,46,.3)_28%,rgba(43,26,92,.25)_100%)]" />
        </div>
        <div aria-hidden="true" className="absolute -left-40 bottom-[-20%] size-96 rounded-full bg-accent/25 blur-[100px]" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-16 pt-12 sm:px-8 md:pb-20 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <div className="flex flex-col gap-6">
            {/* The live next start date when a cohort is open, otherwise the eyebrow text from Settings. */}
            {next ? (
              <Link href={`/enroll?cohort=${next.cohort.id}`} className="group flex w-fit items-center gap-2.5 rounded-full border border-white/15 bg-white/5 py-1.5 pl-3.5 pr-3 text-[13px] font-medium text-white/80 transition hover:border-white/30 hover:bg-white/10">
                <span className="relative flex size-2" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-cyan" />
                </span>
                <span>Next intake <span className="font-semibold text-white">{nextStart ?? "opening soon"}</span></span>
                <ArrowRight className="size-3.5 text-cyan-light transition group-hover:translate-x-0.5" />
              </Link>
            ) : settings.heroEyebrow && (
              <p className="flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-mono text-xs font-medium uppercase tracking-[1.2px] text-cyan-light">
                <span className="size-2 rounded-full bg-cyan" aria-hidden="true" /> {settings.heroEyebrow}
              </p>
            )}
            <h1 className="max-w-[600px] font-display text-[40px] font-extrabold leading-[1.04] tracking-[-1.5px] text-white sm:text-5xl lg:text-[56px] lg:tracking-[-2px]">
              {/* Words wrapped in *asterisks* in Settings are highlighted. */}
              {(settings.heroTitle || settings.siteName).split(/\*([^*]+)\*/).map((part, i) => (i % 2 ? <span key={i} className="text-cyan-light">{part}</span> : part))}
            </h1>
            {settings.heroSubtitle && <p className="max-w-[560px] text-lg leading-[1.65] text-white/75 md:text-[19px]">{settings.heroSubtitle}</p>}
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href="/courses" className="flex h-13 items-center gap-2 rounded-xl bg-accent px-7 text-base font-semibold text-white shadow-[0_12px_32px_-10px_rgba(113,52,217,.9)] transition hover:-translate-y-0.5 hover:bg-accent-mid">
                Browse courses <ArrowRight className="size-[18px]" />
              </Link>
              <a href="#formats" className="flex h-13 items-center rounded-xl border-[1.5px] border-white/40 px-7 text-base font-semibold text-white transition hover:border-white hover:bg-white/10">How we teach</a>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-white/85" aria-label="Course benefits">
              {["Beginner-friendly", "Live instructor support", "Portfolio projects"].map((item) => (
                <li key={item} className="flex items-center gap-2"><span className="flex size-5 items-center justify-center rounded-full bg-cyan/15 text-cyan-light"><CheckIcon className="size-3.5" /></span>{item}</li>
              ))}
            </ul>
            {settings.stats.length > 0 && (
              <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-white/15 pt-7 sm:grid-cols-4">
                {settings.stats.map((s) => (
                  <div key={s.label} className="flex flex-col-reverse justify-end gap-1">
                    <dt className="text-sm leading-snug text-white/60">{s.label}</dt>
                    <dd className="font-display text-3xl font-bold tracking-tight text-cyan">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          {/* Large screens only: space beside the text for the photo, with the feedback chip over it. Phones and tablets show no photo. */}
          <div aria-hidden="true" className="relative hidden select-none lg:block lg:min-h-[520px]">
            <div className="absolute bottom-6 right-10 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_18px_40px_-16px_rgba(0,0,0,.6)]">
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon className="size-5" /></span>
              <span><span className="block text-sm font-semibold text-ink">Feedback received</span><span className="block text-xs text-muted">Sales dashboard · 86/100</span></span>
            </div>
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

      {/* Formats */}
      <section id="formats" className="scroll-mt-20 border-t border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-20 sm:px-8 md:py-24">
          <SectionHeading eyebrow="How we teach" title="Online, in person, or both" subtitle="Every cohort has a clear timetable. Each class is either live online or in our training space, and you always know which." />
          <div className="grid gap-5 md:grid-cols-3">
            {FORMATS.map(({ icon: Icon, tone, title, text, points }) => (
              <div key={title} className="group flex flex-col gap-4 rounded-[20px] border border-edge bg-panel p-6 transition hover:-translate-y-1 hover:border-accent-muted hover:bg-white hover:shadow-[0_18px_45px_-24px_rgba(25,17,46,.35)] md:p-7">
                <span className={`flex size-12 items-center justify-center rounded-xl ${tone}`}><Icon className="size-6" /></span>
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
          <div className="relative overflow-hidden rounded-[5px] border border-edge bg-white p-2 shadow-[0_20px_55px_-36px_rgba(25,17,46,.45)]">
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
              <Link href="/courses" className="flex h-11 items-center gap-2 rounded-lg border border-edge-strong bg-white px-5 font-semibold text-ink hover:bg-page">All courses <ArrowRight className="size-4" /></Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((course) => <CourseCard key={course.id} course={course} currencies={currencies} />)}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="how" className="relative scroll-mt-20 overflow-hidden border-t border-line bg-navy text-white">
        <div aria-hidden="true" className="absolute inset-0">
          <Image src="/images/how-it-works-classroom.webp" alt="" fill sizes="100vw" className="object-cover object-center" />
          {/* Dark behind the heading, fading into brand purple behind the steps. */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(25,17,46,.86)_0%,rgba(25,17,46,.72)_35%,rgba(58,24,130,.86)_75%,#5a24b8_100%)]" />
        </div>
        <div className="relative mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-20 sm:px-8 md:py-28">
          <div className="flex flex-col gap-3.5">
            <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-cyan-light md:text-[13px]">How it works</p>
            <h2 className="max-w-[640px] font-display text-3xl font-bold tracking-tight [text-shadow:0_2px_24px_rgba(0,0,0,.35)] md:text-[44px] md:leading-[1.1]">From sign-up to your first piece of feedback</h2>
          </div>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3 rounded-[14px] border border-white/15 bg-navy/55 p-6 backdrop-blur-md">
                <span className="font-mono text-sm text-accent-muted">0{i + 1}</span>
                <h3 className="font-display text-xl font-bold">{step.title}</h3>
                <p className="text-[15px] leading-relaxed text-white/75">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Platform features */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-20 sm:px-8 md:py-24">
          <SectionHeading eyebrow="Your learning space" title="Everything for your cohort, in one dashboard" subtitle="Classes, assignments, feedback and payments, organised for you from day one." />
          <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon className="size-5" /></span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
                  <p className="text-[15px] leading-relaxed text-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming cohorts */}
      {upcoming.length > 0 && (
        <section className="border-t border-line">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-20 sm:px-8 md:py-24">
            <SectionHeading align="left" eyebrow="Upcoming cohorts" title="Next start dates" />
            <ul className="flex flex-col divide-y divide-edge overflow-hidden rounded-[14px] border border-edge bg-white">
              {upcoming.map(({ cohort, course }) => {
                const left = cohort.capacity ? Math.max(0, cohort.capacity - (taken.get(cohort.id) ?? 0)) : null;
                const priceCurrency = [...currencies, ...Object.keys(cohort.prices)].find((c) => (cohort.prices[c] ?? 0) > 0);
                const price = priceCurrency ? cohort.prices[priceCurrency] : undefined;
                const [y, m, d] = (cohort.startDate ?? "").split("-");
                const month = cohort.startDate ? new Date(Date.UTC(+y, +m - 1, +d)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) : "TBC";
                return (
                  <li key={cohort.id}>
                    <Link href={`/courses/${course.slug}#cohort-${cohort.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5 hover:bg-panel md:flex-nowrap md:px-6">
                      <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-soft text-accent">
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
                <figure key={t.name} className="relative flex flex-col gap-5 overflow-hidden rounded-[20px] border border-edge bg-panel p-6 transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_45px_-24px_rgba(25,17,46,.3)] md:p-7">
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
            <div className="flex flex-col divide-y divide-edge rounded-[14px] border border-edge bg-white">
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
