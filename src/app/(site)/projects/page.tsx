import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { CourseArt } from "@/components/site/course-art";
import { HeroHighlight, PageHero, heroButton } from "@/components/site/page-hero";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { publishedProjects } from "@/lib/showcase-data";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  return pageMetadata(seo, { title: "Student projects", description: `Real dashboards, analyses and pipelines built by ${seo.siteName} students, graded by their instructors.`, path: "/projects" });
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { course } = await searchParams;
  const all = await publishedProjects();
  const courseOptions = [...new Map(all.filter((r) => r.courseSlug).map((r) => [r.courseSlug!, r.courseTitle!])).entries()];
  const shown = course ? all.filter((r) => r.courseSlug === course) : all;
  const chip = (active: boolean) => `rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-accent text-white" : "border border-edge bg-white text-body hover:border-accent-muted hover:text-accent"}`;

  return (
    <>
      <PageHero
        eyebrow="Student projects"
        title={<>Built by our <HeroHighlight>students</HeroHighlight></>}
        lead="Every project here was submitted as coursework, graded by an instructor, and published by the student who built it."
        actions={<>
          <Link href="/courses" className={heroButton.primary}>Learn to build this <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
          <Link href="/free-classes" className={heroButton.secondary}>Try a free class</Link>
        </>}
      />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-5 py-14 sm:px-8 md:py-20">
        {courseOptions.length > 1 && (
          <nav aria-label="Filter by course" className="flex flex-wrap gap-2">
            <Link href="/projects" className={chip(!course)}>All projects</Link>
            {courseOptions.map(([slug, title]) => <Link key={slug} href={`/projects?course=${slug}`} className={chip(course === slug)}>{title}</Link>)}
          </nav>
        )}
        {shown.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map(({ project: p, studentName, courseTitle }) => (
              <Link key={p.id} href={`/projects/${p.slug}`} className="group flex flex-col overflow-hidden rounded-[12px] border border-edge bg-white transition hover:-translate-y-0.5 hover:border-accent-muted hover:shadow-[0_24px_50px_-30px_rgba(24,19,64,.45)]">
                <div className="relative aspect-[16/10] overflow-hidden bg-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <CourseArt seed={p.id} className="size-full" />}
                </div>
                <div className="flex grow flex-col gap-2 p-5">
                  {courseTitle && <p className="font-mono text-[11px] font-semibold uppercase tracking-[1.4px] text-accent">{courseTitle}</p>}
                  <h2 className="font-display text-lg font-bold leading-snug text-ink group-hover:text-accent">{p.title}</h2>
                  <p className="line-clamp-2 text-sm leading-relaxed text-muted">{p.summary}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <span className="text-sm font-semibold text-body">{studentName}</span>
                    <span className="flex flex-wrap gap-1.5">{p.tools.slice(0, 2).map((t) => <span key={t} className="rounded-full bg-page px-2.5 py-0.5 text-xs font-semibold text-body">{t}</span>)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-[12px] border border-dashed border-edge-strong bg-panel p-8">
            <h2 className="font-display text-xl font-bold text-ink">The first projects are on their way</h2>
            <p className="max-w-[560px] text-[15px] text-body">Our instructors pick standout coursework for this page. Check back soon, or start building your own.</p>
            <Link href="/courses" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:text-accent-dark">Browse courses <ArrowRight className="size-4" /></Link>
          </div>
        )}
      </div>
    </>
  );
}
