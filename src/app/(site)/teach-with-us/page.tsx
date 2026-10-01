import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, AwardIcon, CalendarIcon, CardIcon, CheckIcon, ClockIcon, LayersIcon, MonitorIcon, UsersIcon } from "@/components/icons";
import { HeroHighlight, HeroVisual, PageHero, heroButton } from "@/components/site/page-hero";
import { pageMetadata, seoConfig } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  return pageMetadata(seo, { title: "Become an instructor", description: "Teach what you do every day. Run live cohorts online or in person with the academy behind you: students, platform and support included.", path: "/teach-with-us" });
}

const BENEFITS = [
  { icon: CardIcon, title: "Earn from your expertise", text: "Get paid for the cohorts you teach. We agree the terms with you before your first class." },
  { icon: CalendarIcon, title: "Teach on your schedule", text: "Evenings, weekends or weekdays, live online or in person. You choose what fits around your work." },
  { icon: UsersIcon, title: "We bring the students", text: "Marketing, enrolment, payments and student support are handled for you, so you can focus on teaching." },
  { icon: LayersIcon, title: "Everything in one place", text: "Build lessons and quizzes, run live classes, take attendance and give feedback from one dashboard." },
  { icon: MonitorIcon, title: "Hands-on tools", text: "Students practise as they learn, with quizzes, real projects and SQL they can run right in the browser." },
  { icon: AwardIcon, title: "Grow your profile", text: "Build your reputation as a teacher and help people start careers in tech." },
];

const LOOKING_FOR = [
  "At least two years of hands-on experience in the area you'd teach",
  "You enjoy explaining things clearly and patiently",
  "You can commit to a cohort's schedule, usually a few hours a week",
  "A laptop and reliable internet for live online classes",
];

const STEPS = [
  { title: "Apply", text: "Tell us about your experience and what you'd like to teach. It takes about five minutes." },
  { title: "Meet the team", text: "If it's a good fit, we'll set up a short call to talk about topics, format and timing." },
  { title: "Teach a demo", text: "Show us how you teach with a 15-minute sample lesson on a topic of your choice." },
  { title: "Start your cohort", text: "We set up your instructor account and your first cohort, and help you get your lessons ready." },
];

const FAQS = [
  { q: "Do I need teaching experience?", a: "No. Real-world experience matters most. If you're new to teaching, we'll help you plan your lessons and give you feedback on your demo." },
  { q: "Can I teach only online?", a: "Yes. Most cohorts run live online. If you're near our training space, you can also teach in person or hybrid." },
  { q: "How much time does it take?", a: "Usually a few hours a week while a cohort runs: live classes, plus time to prepare and give feedback on assignments." },
  { q: "Do I have to create a course from scratch?", a: "Not necessarily. You can teach one of our existing courses or propose a new one. The curriculum builder makes it quick to put lessons, videos and quizzes together." },
  { q: "How are instructors paid?", a: "Instructors are paid for the cohorts they teach. We'll agree the terms with you before you start." },
];


export default function TeachWithUsPage() {
  return (
    <>
      <PageHero
        eyebrow="Teach with us"
        title={<>Become an <HeroHighlight>instructor</HeroHighlight></>}
        lead="Share what you do every day with people who are ready to learn it. Teach live cohorts online or in person, and we'll take care of the students, the platform and the admin."
        actions={<>
          <Link href="/teach-with-us/apply" className={heroButton.primary}>Apply to teach <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
          <a href="#how" className={heroButton.secondary}>How it works</a>
        </>}
        facts={[
          { icon: ClockIcon, label: "To apply", value: "About 5 minutes" },
          { icon: MonitorIcon, label: "Format", value: "Online or in person" },
        ]}
        aside={
          <HeroVisual notes={[{ icon: UsersIcon, title: "Your cohort", text: "Students ready to learn" }, { icon: CheckIcon, title: "Lesson published" }]}>
            <Image src="/images/academy-instructor-support.webp" alt="An instructor helping students during a class" width={1120} height={840} priority sizes="(min-width: 1024px) 540px, 100vw" className="aspect-[4/3] w-full object-cover" />
          </HeroVisual>
        }
      />

      <section className="border-y border-line bg-panel">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-16 sm:px-8 md:py-20">
          <div className="flex max-w-[640px] flex-col gap-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent">Why teach with us</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">You teach. We handle the rest.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex flex-col gap-3 rounded-[5px] border border-edge bg-white p-6">
                <span className="flex size-11 items-center justify-center rounded-[5px] bg-accent-soft text-accent"><Icon className="size-5" /></span>
                <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
                <p className="text-[15px] leading-6 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1200px] flex-col gap-8 px-5 py-16 sm:px-8 md:py-20">
        <div className="flex max-w-[680px] flex-col gap-4">
          <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent">Who we&apos;re looking for</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">Practitioners who love to share</h2>
          <p className="text-lg leading-relaxed text-muted">Our students learn from people who do the work every day. If that&apos;s you, and you enjoy helping others get better, we&apos;d like to hear from you.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {LOOKING_FOR.map((item) => (
            <li key={item} className="flex items-start gap-3 rounded-[5px] border border-edge bg-white px-5 py-4 text-[15px] text-body"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon className="size-3.5" /></span>{item}</li>
          ))}
        </ul>
      </section>

      <section id="how" className="scroll-mt-28 border-y border-line bg-panel">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-16 sm:px-8 md:py-20">
          <div className="flex max-w-[640px] flex-col gap-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent">How it works</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">From application to your first class</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
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
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">Questions instructors ask</h2>
        <div className="divide-y divide-line rounded-[5px] border border-edge bg-white">
          {FAQS.map((faq) => (
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
            <h2 className="font-display text-2xl font-bold md:text-3xl">Ready to teach?</h2>
            <p className="max-w-[520px] text-white/75">Apply in about five minutes. We&apos;ll be in touch within a week.</p>
          </div>
          <Link href="/teach-with-us/apply" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-[5px] bg-white px-6 font-semibold text-accent transition hover:-translate-y-0.5">Apply to teach <ArrowRight className="size-4" /></Link>
        </div>
      </section>
    </>
  );
}
