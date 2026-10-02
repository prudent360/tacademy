import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, AwardIcon, BriefcaseIcon, UsersIcon } from "@/components/icons";
import { HeroHighlight, PageHero, heroButton } from "@/components/site/page-hero";
import { CourseCard } from "@/components/site/course-card";
import { EmptyState } from "@/components/ui";
import { withCohorts } from "@/lib/catalog";
import { getPublishedCourses, getSettings } from "@/lib/data";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { visitorCurrencies } from "@/lib/visitor";
import { ratingsFor } from "@/lib/reviews";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  return pageMetadata(seo, { title: "Internships", description: seo.internshipsDescription || "Hands-on internship programmes: free for graduates of our courses, and open to everyone else for a fee.", path: "/internships" });
}

const POINTS = [
  { icon: BriefcaseIcon, title: "Real projects", text: "Work on practical briefs with deadlines, reviews and feedback, the way teams work." },
  { icon: UsersIcon, title: "Supervised by practitioners", text: "Your supervisor checks in on your progress and reviews what you ship." },
  { icon: AwardIcon, title: "Free for our graduates", text: "Completed one of our courses? Sign in and join eligible intakes at no cost." },
];

export default async function InternshipsPage() {
  const [settings, courses] = await Promise.all([getSettings(), getPublishedCourses()]);
  const [programmes, { currencies }] = await Promise.all([withCohorts(courses.filter((c) => c.kind === "internship")), visitorCurrencies(settings)]);
  const ratings = await ratingsFor(programmes.map((p) => p.id));

  return (
    <>
    <PageHero
      eyebrow="Internships"
      title={<>Put your skills <HeroHighlight>to work</HeroHighlight></>}
      lead="Our internship programmes give you supervised, real-world experience. Graduates of our courses join free; anyone else can join by paying the programme fee."
      actions={<>
        <Link href="/internships/apply" className={heroButton.primary}>Apply now <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
        {programmes.length > 0 && <a href="#programmes" className={heroButton.secondary}>See programmes</a>}
      </>}
    />
    <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-12 sm:px-8 md:py-16">
      <div className="grid gap-4 sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-[5px] border border-edge bg-panel p-5">
            <Icon className="size-5 text-accent" />
            <h2 className="mt-4 font-display text-lg font-bold text-ink">{title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">{text}</p>
          </div>
        ))}
      </div>
      {programmes.length ? (
        <div id="programmes" className="grid scroll-mt-28 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programmes.map((programme) => <CourseCard key={programme.id} course={programme} currencies={currencies} rating={ratings.get(programme.id)} />)}
        </div>
      ) : (
        <EmptyState icon={BriefcaseIcon} title="New internship intakes are coming soon">
          {settings.supportEmail ? <>Email <a href={`mailto:${settings.supportEmail}`} className="font-semibold text-accent">{settings.supportEmail}</a> to hear when the next one opens, or <Link href="/courses" className="font-semibold text-accent">browse our courses</Link>.</> : <>In the meantime, <Link href="/courses" className="font-semibold text-accent">browse our courses</Link>.</>}
        </EmptyState>
      )}
    </div>
    </>
  );
}
