import type { Metadata } from "next";
import Image from "next/image";
import { InstructorApplicationForm } from "@/components/site/instructor-application-form";
import { getPublishedCourses, getSettings } from "@/lib/data";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { visitorCountry } from "@/lib/visitor";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  return pageMetadata(seo, { title: "Apply to teach", description: "Apply to become an instructor: tell us about your experience and what you'd like to teach.", path: "/teach-with-us/apply" });
}

export default async function TeachApplyPage() {
  const [settings, courses, country] = await Promise.all([getSettings(), getPublishedCourses(), visitorCountry()]);
  const subjects = courses.filter((c) => c.kind === "course").map((c) => c.title);

  return (
    <div data-under-header data-no-footer className="relative bg-navy">
      {/* The photo stays put while the form scrolls over it (a sticky layer, since iOS ignores background-attachment: fixed). */}
      <div aria-hidden="true" className="absolute inset-0">
        <div className="sticky top-0 h-[100dvh] overflow-hidden">
          <Image src="/images/academy-instructor-support.webp" alt="" fill priority sizes="100vw" className="object-cover object-[center_30%]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,19,64,.82)_0%,rgba(33,26,92,.72)_45%,rgba(61,47,184,.8)_100%)]" />
        </div>
      </div>
      <div className="relative mx-auto flex max-w-[860px] flex-col gap-10 px-5 pb-20 pt-14 sm:px-8 md:pt-20">
        <div className="flex flex-col gap-3 text-center">
          <p className="font-mono text-xs font-medium uppercase tracking-[1.5px] text-cyan-light md:text-[13px]">Become an instructor</p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,.35)] md:text-5xl">Apply to teach</h1>
          <p className="mx-auto max-w-[600px] text-lg text-white/75">Tell us about your experience and what you&apos;d like to teach. It takes about five minutes, and we&apos;ll be in touch within a week{settings.supportEmail ? <> (questions: <a href={`mailto:${settings.supportEmail}`} className="font-semibold text-cyan-light underline decoration-white/30 underline-offset-4 hover:decoration-cyan-light">{settings.supportEmail}</a>)</> : null}.</p>
        </div>
        <InstructorApplicationForm subjects={subjects} defaultCountry={country ?? undefined} />
      </div>
    </div>
  );
}
