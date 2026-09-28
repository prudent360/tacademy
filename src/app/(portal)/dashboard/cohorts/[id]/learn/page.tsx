import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BookIcon, CheckCircleIcon, ClockIcon, PlayIcon } from "@/components/icons";
import { ProgressBar } from "@/components/portal/dash";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courseModules, enrollments, lessonProgress, lessons } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCohortWithCourse } from "@/lib/data";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const cohortId = idParam(raw);
  if (!cohortId) notFound();
  const user = await requireUser();
  const db = await getDb();
  const [[enrollment], found] = await Promise.all([
    db.select().from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["active", "completed"]))),
    getCohortWithCourse(cohortId),
  ]);
  if (!enrollment || !found) notFound();
  const rows = await db.select({ module: courseModules, lesson: lessons }).from(courseModules).leftJoin(lessons, and(eq(lessons.moduleId, courseModules.id), eq(lessons.published, true))).where(and(eq(courseModules.courseId, found.course.id), eq(courseModules.published, true))).orderBy(asc(courseModules.position), asc(courseModules.id), asc(lessons.position), asc(lessons.id));
  const lessonIds = rows.flatMap((row) => row.lesson ? [row.lesson.id] : []);
  const progress = lessonIds.length ? await db.select().from(lessonProgress).where(and(eq(lessonProgress.enrollmentId, enrollment.id), inArray(lessonProgress.lessonId, lessonIds))) : [];
  const completed = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId));
  const modules = [...new Map(rows.map((row) => [row.module.id, { ...row.module, lessons: rows.filter((x) => x.module.id === row.module.id && x.lesson).map((x) => x.lesson!) }])).values()];
  const next = modules.flatMap((module) => module.lessons).find((lesson) => !completed.has(lesson.id));

  return <>
    <PageHeader back={{ href: `/dashboard/cohorts/${cohortId}`, label: found.course.title }} title="Course learning" description={`${found.cohort.name} · ${completed.size} of ${lessonIds.length} lessons completed`} actions={next && <Link href={`/dashboard/cohorts/${cohortId}/learn/${next.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark"><PlayIcon className="size-4" /> Continue learning</Link>} />
    {lessonIds.length > 0 && <Card><ProgressBar value={completed.size} max={lessonIds.length} label="Course progress" detail={`${Math.round((completed.size / lessonIds.length) * 100)}%`} /></Card>}
    {modules.length ? <div className="flex flex-col gap-5">{modules.map((module, index) => {
      const done = module.lessons.filter((lesson) => completed.has(lesson.id)).length;
      return <Card key={module.id} title={`${index + 1}. ${module.title}`} action={<Badge tone={done === module.lessons.length && done > 0 ? "green" : "neutral"}>{done}/{module.lessons.length} complete</Badge>}>
        {module.summary && <p className="mb-4 text-sm text-muted">{module.summary}</p>}
        {module.lessons.length ? <ol className="-mx-2 flex flex-col divide-y divide-line">{module.lessons.map((lesson) => {
          const isDone = completed.has(lesson.id);
          return <li key={lesson.id}><Link href={`/dashboard/cohorts/${cohortId}/learn/${lesson.id}`} className="group flex items-center gap-4 rounded-[5px] px-2 py-3.5 hover:bg-panel"><span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${isDone ? "bg-emerald-50 text-emerald-700" : "bg-accent-soft text-accent"}`}>{isDone ? <CheckCircleIcon className="size-5" /> : <PlayIcon className="size-5" />}</span><span className="flex min-w-0 grow flex-col"><span className="font-semibold text-ink group-hover:text-accent">{lesson.title}</span>{lesson.summary && <span className="truncate text-sm text-muted">{lesson.summary}</span>}</span><span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted"><ClockIcon className="size-3.5" /> {lesson.estimatedMinutes} min</span></Link></li>;
        })}</ol> : <p className="text-sm text-muted">Lessons are being prepared.</p>}
      </Card>;
    })}</div> : <EmptyState icon={BookIcon} title="Learning content is coming soon">Your classes, assignments and announcements are still available from the cohort page.</EmptyState>}
  </>;
}
