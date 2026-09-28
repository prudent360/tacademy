import type { Metadata } from "next";
import Link from "next/link";
import { AwardIcon, BriefcaseIcon, UsersIcon } from "@/components/icons";
import { CourseCard } from "@/components/site/course-card";
import { EmptyState } from "@/components/ui";
import { withCohorts } from "@/lib/catalog";
import { getPublishedCourses, getSettings } from "@/lib/data";
import { visitorCurrencies } from "@/lib/visitor";

export const metadata: Metadata = {
  title: "Internships",
  description: "Hands-on internship programmes: free for graduates of our courses, and open to everyone else for a fee.",
  alternates: { canonical: "/internships" },
};

const POINTS = [
  { icon: BriefcaseIcon, title: "Real projects", text: "Work on practical briefs with deadlines, reviews and feedback, the way teams work." },
  { icon: UsersIcon, title: "Supervised by practitioners", text: "Your supervisor checks in on your progress and reviews what you ship." },
  { icon: AwardIcon, title: "Free for our graduates", text: "Completed one of our courses? Sign in and join eligible intakes at no cost." },
];

export default async function InternshipsPage() {
  const [settings, courses] = await Promise.all([getSettings(), getPublishedCourses()]);
  const [programmes, { currencies }] = await Promise.all([withCohorts(courses.filter((c) => c.kind === "internship")), visitorCurrencies(settings)]);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 py-14 sm:px-8 md:py-20">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent md:text-[13px]">Internships</p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">Put your skills to work</h1>
        <p className="max-w-[640px] text-lg text-muted">Our internship programmes give you supervised, real-world experience. Graduates of our courses join free; anyone else can join by paying the programme fee.</p>
      </div>
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {programmes.map((programme) => <CourseCard key={programme.id} course={programme} currencies={currencies} />)}
        </div>
      ) : (
        <EmptyState icon={BriefcaseIcon} title="New internship intakes are coming soon">
          {settings.supportEmail ? <>Email <a href={`mailto:${settings.supportEmail}`} className="font-semibold text-accent">{settings.supportEmail}</a> to hear when the next one opens, or <Link href="/courses" className="font-semibold text-accent">browse our courses</Link>.</> : <>In the meantime, <Link href="/courses" className="font-semibold text-accent">browse our courses</Link>.</>}
        </EmptyState>
      )}
    </div>
  );
}
