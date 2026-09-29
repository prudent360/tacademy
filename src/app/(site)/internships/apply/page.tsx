import type { Metadata } from "next";
import { ApplicationForm, type ApplicationIntake } from "@/components/site/application-form";
import { withCohorts } from "@/lib/catalog";
import { getPublishedCourses, getSettings } from "@/lib/data";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { formatDateOnly } from "@/lib/time";
import { MODE_LABEL } from "@/lib/utils";
import { visitorCountry } from "@/lib/visitor";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  return pageMetadata(seo, { title: "Apply for an internship", description: "Apply to join our internship programme: supervised, real-world projects, free for graduates of our courses.", path: "/internships/apply" });
}

export default async function ApplyPage() {
  const [settings, courses, country] = await Promise.all([getSettings(), getPublishedCourses(), visitorCountry()]);
  const programmes = await withCohorts(courses.filter((c) => c.kind === "internship"));
  const intakes: ApplicationIntake[] = programmes.flatMap((p) => p.cohorts
    .filter((c) => c.enrollmentOpen && !c.full)
    .map((c) => ({ id: c.id, label: `${p.title} · ${c.name}${c.startDate ? ` (starts ${formatDateOnly(c.startDate)})` : ""} · ${MODE_LABEL[c.deliveryMode]}` })));

  return (
    <div className="bg-page">
      <div className="mx-auto flex max-w-[860px] flex-col gap-10 px-5 py-14 sm:px-8 md:py-20">
        <div className="flex flex-col gap-3 text-center">
          <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-accent md:text-[13px]">Internship programme</p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">Apply to join</h1>
          <p className="mx-auto max-w-[600px] text-lg text-muted">Tell us about yourself and what you&apos;d like to work on. It takes about five minutes, and we&apos;ll email you with the outcome{settings.supportEmail ? <> (questions: <a href={`mailto:${settings.supportEmail}`} className="font-semibold text-accent">{settings.supportEmail}</a>)</> : null}.</p>
        </div>
        <ApplicationForm programmes={programmes.map((p) => p.title)} intakes={intakes} defaultCountry={country ?? undefined} />
      </div>
    </div>
  );
}
