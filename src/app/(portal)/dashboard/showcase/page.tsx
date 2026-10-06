import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AwardIcon, ExternalIcon } from "@/components/icons";
import { Badge, buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courses, showcaseProjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { SHOWCASE_STATUS_LABEL, SHOWCASE_STATUS_TONE } from "@/lib/showcase";
import { relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Showcase" };

export default async function MyShowcasePage() {
  const user = await requireUser();
  const projects = await (await getDb()).select({ project: showcaseProjects, courseTitle: courses.title }).from(showcaseProjects).leftJoin(courses, eq(courses.id, showcaseProjects.courseId)).where(eq(showcaseProjects.userId, user.id)).orderBy(desc(showcaseProjects.createdAt));
  return (
    <>
      <PageHeader title="Showcase" description="When an instructor picks your work for the public Projects page, it appears here. You decide whether it's published." actions={<Link href="/projects" target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> See the Projects page</Link>} />
      {projects.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map(({ project: p, courseTitle }) => (
            <Card key={p.id}>
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="font-display text-lg font-bold text-ink">{p.title}</p>{courseTitle && <p className="text-sm text-muted">{courseTitle}</p>}</div>
                  <Badge tone={SHOWCASE_STATUS_TONE[p.status]}>{SHOWCASE_STATUS_LABEL[p.status]}</Badge>
                </div>
                <p className="text-sm text-muted">{p.status === "invited" ? `Invited ${relativeTime(p.createdAt)}. Review it and publish when you're ready.` : p.status === "published" ? `Live on the Projects page since ${relativeTime(p.publishedAt ?? p.updatedAt)}.` : p.status === "declined" ? "Not published. You can still publish it." : "Hidden by the team."}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/showcase/${p.id}`} className={p.status === "invited" ? buttonClass.primary : buttonClass.secondary}>{p.status === "invited" ? "Review and publish" : "Edit"}</Link>
                  {p.status === "published" && <Link href={`/projects/${p.slug}`} target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View</Link>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={AwardIcon} title="No projects yet">Do great work on your assignments: instructors can invite your best graded projects to the public showcase, which you can share with employers.</EmptyState>
      )}
    </>
  );
}
