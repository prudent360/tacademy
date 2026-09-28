import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BookIcon, CheckCircleIcon, ClipboardIcon, ClockIcon, PlayIcon } from "@/components/icons";
import { ProgressBar } from "@/components/portal/dash";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { assignments, courseModules, enrollments, lessonProgress, lessons, moduleReleases, submissions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCohortWithCourse, getSettings } from "@/lib/data";
import { formatDateTime } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const cohortId = idParam(raw);
  if (!cohortId) notFound();
  const user = await requireUser();
  const db = await getDb();
  const [[enrollment], found, settings] = await Promise.all([
    db.select().from(enrollments).where(and(eq(enrollments.userId, user.id), eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["active", "completed"]))),
    getCohortWithCourse(cohortId),
    getSettings(),
  ]);
  if (!enrollment || !found) notFound();

  const rows = await db.select({ module: courseModules, lesson: lessons, releaseAt: moduleReleases.releaseAt })
    .from(courseModules)
    .leftJoin(lessons, and(eq(lessons.moduleId, courseModules.id), eq(lessons.published, true)))
    .leftJoin(moduleReleases, and(eq(moduleReleases.moduleId, courseModules.id), eq(moduleReleases.cohortId, cohortId)))
    .where(and(eq(courseModules.courseId, found.course.id), eq(courseModules.published, true)))
    .orderBy(asc(courseModules.position), asc(courseModules.id), asc(lessons.position), asc(lessons.id));
  const lessonIds = rows.flatMap((row) => row.lesson ? [row.lesson.id] : []);
  const [progress, linkedAssignments] = await Promise.all([
    lessonIds.length ? db.select().from(lessonProgress).where(and(eq(lessonProgress.enrollmentId, enrollment.id), inArray(lessonProgress.lessonId, lessonIds))) : [],
    lessonIds.length ? db.select({ assignment: assignments, submission: submissions }).from(assignments).leftJoin(submissions, and(eq(submissions.assignmentId, assignments.id), eq(submissions.userId, user.id))).where(and(eq(assignments.cohortId, cohortId), eq(assignments.published, true), inArray(assignments.lessonId, lessonIds))) : [],
  ]);
  const completedLessons = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId));
  const startedLessons = new Set(progress.map((p) => p.lessonId));
  const completedAssignments = new Set(linkedAssignments.filter((row) => row.submission && row.submission.status !== "resubmit").map((row) => row.assignment.id));
  const now = new Date();
  const modules = [...new Map(rows.map((row) => [row.module.id, {
    ...row.module,
    releaseAt: row.releaseAt,
    locked: Boolean(row.releaseAt && row.releaseAt > now),
    lessons: rows.filter((x) => x.module.id === row.module.id && x.lesson).map((x) => x.lesson!),
  }])).values()];
  const availableLessons = modules.filter((module) => !module.locked).flatMap((module) => module.lessons);
  const next = availableLessons.find((lesson) => !completedLessons.has(lesson.id));
  const availableAssignments = linkedAssignments.filter((row) => availableLessons.some((lesson) => lesson.id === row.assignment.lessonId));
  const completedCount = availableLessons.filter((lesson) => completedLessons.has(lesson.id)).length + availableAssignments.filter((row) => completedAssignments.has(row.assignment.id)).length;
  const activityCount = availableLessons.length + availableAssignments.length;

  return <>
    <PageHeader back={{ href: `/dashboard/cohorts/${cohortId}`, label: found.course.title }} title="Course learning" description={`${found.cohort.name} · ${completedCount} of ${activityCount} available activities completed`} actions={next && <Link href={`/dashboard/cohorts/${cohortId}/learn/${next.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark"><PlayIcon className="size-4" /> Continue learning</Link>} />
    {activityCount > 0 && <Card><ProgressBar value={completedCount} max={activityCount} label="Available course progress" detail={`${Math.round((completedCount / activityCount) * 100)}%`} /></Card>}
    {modules.length ? <div className="flex flex-col gap-5">{modules.map((module, index) => {
      const moduleAssignments = linkedAssignments.filter((row) => module.lessons.some((lesson) => lesson.id === row.assignment.lessonId));
      const done = module.lessons.filter((lesson) => completedLessons.has(lesson.id)).length + moduleAssignments.filter((row) => completedAssignments.has(row.assignment.id)).length;
      const total = module.lessons.length + moduleAssignments.length;
      return <Card key={module.id} title={`${index + 1}. ${module.title}`} action={module.locked ? <Badge tone="amber">Opens {formatDateTime(module.releaseAt!, settings.timezone)}</Badge> : <Badge tone={done === total && done > 0 ? "green" : "neutral"}>{done}/{total} complete</Badge>}>
        {module.summary && <p className="mb-4 text-sm text-muted">{module.summary}</p>}
        {module.locked ? <p className="flex items-center gap-2 rounded-[5px] bg-amber-50 p-4 text-sm text-amber-900"><ClockIcon className="size-5" /> This module will unlock automatically at the scheduled time.</p> : module.lessons.length ? <ol className="-mx-2 flex flex-col divide-y divide-line">{module.lessons.flatMap((lesson) => {
          const isDone = completedLessons.has(lesson.id);
          const started = startedLessons.has(lesson.id);
          const lessonRow = <li key={`lesson-${lesson.id}`}><Link href={`/dashboard/cohorts/${cohortId}/learn/${lesson.id}`} className="group flex items-center gap-4 rounded-[5px] px-2 py-3.5 hover:bg-panel"><span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${isDone ? "bg-emerald-50 text-emerald-700" : "bg-accent-soft text-accent"}`}>{isDone ? <CheckCircleIcon className="size-5" /> : <PlayIcon className="size-5" />}</span><span className="flex min-w-0 grow flex-col"><span className="font-semibold text-ink group-hover:text-accent">{lesson.title}</span><span className="truncate text-sm text-muted">{started && !isDone ? "In progress" : lesson.summary || "Not started"}</span></span><span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted"><ClockIcon className="size-3.5" /> {lesson.estimatedMinutes} min</span></Link></li>;
          const assignmentRows = moduleAssignments.filter((row) => row.assignment.lessonId === lesson.id).map((row) => <li key={`assignment-${row.assignment.id}`}><Link href={`/dashboard/assignments/${row.assignment.id}`} className="group ml-11 flex items-center gap-4 rounded-[5px] border-l-2 border-cyan/30 px-4 py-3 hover:bg-panel"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cyan-soft text-cyan-ink">{completedAssignments.has(row.assignment.id) ? <CheckCircleIcon className="size-4" /> : <ClipboardIcon className="size-4" />}</span><span className="flex min-w-0 grow flex-col"><span className="font-semibold text-ink group-hover:text-accent">{row.assignment.title}</span><span className="text-xs text-muted">Assignment · {completedAssignments.has(row.assignment.id) ? "Submitted" : "To do"}</span></span></Link></li>);
          return [lessonRow, ...assignmentRows];
        })}</ol> : <p className="text-sm text-muted">Lessons are being prepared.</p>}
      </Card>;
    })}</div> : <EmptyState icon={BookIcon} title="Learning content is coming soon">Your classes, assignments and announcements are still available from the cohort page.</EmptyState>}
  </>;
}
