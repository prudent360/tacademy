import type { Metadata } from "next";
import Image from "next/image";
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
    <div data-under-header data-no-footer className="relative bg-navy">
      {/* The photo stays fixed to the screen while the form scrolls over it, so it fills the view from top to bottom
          at its natural size (a sticky layer, since iOS ignores background-attachment: fixed). */}
      <div aria-hidden="true" className="absolute inset-0">
        <div className="sticky top-0 h-[100dvh] overflow-hidden">
          <Image src="/images/internship-classroom.webp" alt="" fill priority sizes="100vw" className="object-cover object-[center_30%]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,19,64,.82)_0%,rgba(33,26,92,.72)_45%,rgba(61,47,184,.8)_100%)]" />
        </div>
      </div>
      <div className="relative mx-auto flex max-w-[860px] flex-col gap-10 px-5 pb-20 pt-14 sm:px-8 md:pt-20">
        <div className="flex flex-col gap-3 text-center">
          <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-cyan-light md:text-[13px]">Internship programme</p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,.35)] md:text-5xl">Apply to join</h1>
          <p className="mx-auto max-w-[600px] text-lg text-white/75">Tell us about yourself and what you&apos;d like to work on. It takes about five minutes, and we&apos;ll email you with the outcome{settings.supportEmail ? <> (questions: <a href={`mailto:${settings.supportEmail}`} className="font-semibold text-cyan-light underline decoration-white/30 underline-offset-4 hover:decoration-cyan-light">{settings.supportEmail}</a>)</> : null}.</p>
        </div>
        <ApplicationForm programmes={programmes.map((p) => p.title)} intakes={intakes} defaultCountry={country ?? undefined} />
      </div>
    </div>
  );
}
