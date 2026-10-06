import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowRight, AwardIcon, CheckCircleIcon, ChevronRight, ExternalIcon } from "@/components/icons";
import { CourseArt } from "@/components/site/course-art";
import { getDb } from "@/db";
import { courses, showcaseProjects, users } from "@/db/schema";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { certificateCodeFor } from "@/lib/showcase-data";
import { absoluteUrl } from "@/lib/site";
import { getSettings } from "@/lib/data";

type Props = { params: Promise<{ slug: string }> };

async function findProject(slug: string) {
  const [row] = await (await getDb()).select({ project: showcaseProjects, studentName: users.name, course: courses }).from(showcaseProjects).innerJoin(users, eq(users.id, showcaseProjects.userId)).leftJoin(courses, eq(courses.id, showcaseProjects.courseId)).where(eq(showcaseProjects.slug, slug));
  return row && row.project.status === "published" ? row : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [row, seo] = await Promise.all([findProject((await params).slug), seoConfig()]);
  if (!row) return {};
  const meta = pageMetadata(seo, { title: `${row.project.title} by ${row.studentName}`, description: row.project.summary.slice(0, 160), path: `/projects/${row.project.slug}` });
  return row.project.imageUrl ? { ...meta, openGraph: { ...meta.openGraph, images: [absoluteUrl(row.project.imageUrl)] } } : meta;
}

export default async function ProjectPage({ params }: Props) {
  const row = await findProject((await params).slug);
  if (!row) notFound();
  const { project: p, studentName, course } = row;
  const [certificate, settings] = await Promise.all([certificateCodeFor(p.userId, p.courseId), getSettings()]);
  const published = p.publishedAt ? new Intl.DateTimeFormat("en-GB", { timeZone: settings.timezone, day: "numeric", month: "short", year: "numeric" }).format(p.publishedAt) : null;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-10 px-5 py-12 sm:px-8 md:py-16">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted"><Link href="/projects" className="font-semibold text-accent hover:text-accent-dark">Student projects</Link><ChevronRight className="size-4 shrink-0" /><span aria-current="page" className="truncate">{p.title}</span></nav>
      <header className="flex flex-col gap-4">
        {course && <p className="font-mono text-xs font-semibold uppercase tracking-[1.5px] text-accent">{course.title}</p>}
        <h1 className="max-w-[860px] text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-ink md:text-5xl">{p.title}</h1>
        <p className="text-lg text-body">By <span className="font-semibold text-ink">{studentName}</span>{published && <span className="text-muted"> · {published}</span>}</p>
      </header>
      <div className="overflow-hidden rounded-[16px] border border-edge bg-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.imageUrl ? <img src={p.imageUrl} alt={`Screenshot of ${p.title}`} className="max-h-[620px] w-full object-cover" /> : <CourseArt seed={p.id} className="aspect-[16/7] w-full" />}
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="font-display text-2xl font-bold text-ink">About the project</h2>
          <div className="flex flex-col gap-4 text-[17px] leading-relaxed text-body">{p.summary.split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}</div>
          {p.tools.length > 0 && <div className="flex flex-wrap gap-2">{p.tools.map((t) => <span key={t} className="rounded-full border border-edge bg-white px-3.5 py-1.5 text-sm font-semibold text-body">{t}</span>)}</div>}
          {p.linkUrl && <a href={p.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-12 w-fit items-center gap-2 rounded-full bg-accent px-6 font-semibold text-white hover:bg-accent-dark">Open the project <ExternalIcon className="size-4" /></a>}
        </section>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-col gap-3 rounded-[12px] border border-edge bg-white p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircleIcon className="size-4" /> Graded coursework</p>
            <p className="text-sm text-muted">Submitted as an assignment and graded by an instructor before it was published here.</p>
            {certificate && <Link href={`/certificates/${certificate}`} className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-dark"><AwardIcon className="size-4" /> Verify {studentName.split(" ")[0]}&apos;s certificate</Link>}
          </div>
          {course && (
            <div className="flex flex-col gap-3 rounded-[12px] bg-[#181340] p-5 text-white">
              <p className="font-mono text-[11px] uppercase tracking-[1.4px] text-cyan-light">Want to build this?</p>
              <p className="font-display text-lg font-bold">{course.title}</p>
              <Link href={`/courses/${course.slug}`} className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#4f3fd7]">See the course <ArrowRight className="size-4" /></Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
