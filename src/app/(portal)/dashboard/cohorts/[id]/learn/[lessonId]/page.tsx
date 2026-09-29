import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { setLessonComplete } from "@/app/actions/learning";
import { ActionButton } from "@/components/forms";
import { ArrowLeft, ArrowRight, CheckCircleIcon, ClockIcon, ExternalIcon, LinkIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { LessonStart } from "@/components/portal/lesson-start";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courseModules, courses, enrollments, lessonProgress, lessons, moduleReleases, quizQuestions, quizzes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { idParam } from "@/lib/validation";
import { askLessonBuddy } from "@/app/actions/ai";
import { AiChat } from "@/components/ai/chat";
import { aiAvailable } from "@/lib/ai";
import { lessonVideo } from "@/lib/video";
import { startQuiz } from "@/app/actions/quiz";
import { quizStatus } from "@/lib/quiz";

export const metadata: Metadata = { title: "Lesson" };

export default async function LessonPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id: rawCohort, lessonId: rawLesson } = await params;
  const cohortId = idParam(rawCohort);
  const lessonId = idParam(rawLesson);
  if (!cohortId || !lessonId) notFound();
  const user = await requireUser();
  const db = await getDb();
  const [found] = await db.select({ enrollment: enrollments, lesson: lessons, module: courseModules, course: courses, releaseAt: moduleReleases.releaseAt }).from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .innerJoin(courseModules, eq(courseModules.courseId, courses.id))
    .innerJoin(lessons, eq(lessons.moduleId, courseModules.id))
    .leftJoin(moduleReleases, and(eq(moduleReleases.cohortId, cohorts.id), eq(moduleReleases.moduleId, courseModules.id)))
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["active", "completed"]), eq(lessons.id, lessonId), eq(courseModules.published, true), eq(lessons.published, true)));
  if (!found || (found.releaseAt && found.releaseAt > new Date())) notFound();
  const allRows = await db.select({ lesson: lessons, module: courseModules, releaseAt: moduleReleases.releaseAt }).from(courseModules).innerJoin(lessons, eq(lessons.moduleId, courseModules.id)).leftJoin(moduleReleases, and(eq(moduleReleases.cohortId, cohortId), eq(moduleReleases.moduleId, courseModules.id))).where(and(eq(courseModules.courseId, found.course.id), eq(courseModules.published, true), eq(lessons.published, true))).orderBy(asc(courseModules.position), asc(courseModules.id), asc(lessons.position), asc(lessons.id));
  const all = allRows.filter((row) => !row.releaseAt || row.releaseAt <= new Date());
  const index = all.findIndex((row) => row.lesson.id === lessonId);
  const previous = all[index - 1]?.lesson;
  const next = all[index + 1]?.lesson;
  const [progress] = await db.select().from(lessonProgress).where(and(eq(lessonProgress.enrollmentId, found.enrollment.id), eq(lessonProgress.lessonId, lessonId)));
  const complete = Boolean(progress?.completedAt);
  const video = await lessonVideo(found.lesson.videoUrl);
  const buddy = await aiAvailable("studyBuddy");
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId));
  const quizQuestionCount = quiz ? (await db.select({ id: quizQuestions.id }).from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id))).length : 0;
  const quizState = quiz && quizQuestionCount ? await quizStatus(found.enrollment.id, quiz) : null;
  // A required quiz decides completion: passing it completes the lesson.
  const quizBlocks = Boolean(quiz?.requiredToComplete && quizState && !quizState.passed && !complete);
  return <>
    <LessonStart cohortId={cohortId} lessonId={lessonId} />
    <PageHeader back={{ href: `/dashboard/cohorts/${cohortId}/learn`, label: "Course learning" }} title={found.lesson.title} description={<span className="flex items-center gap-2">{found.module.title}<Badge><ClockIcon className="size-3.5" /> {found.lesson.estimatedMinutes} min</Badge></span>} />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <main className="flex min-w-0 flex-col gap-6">
        {found.lesson.summary && <p className="text-lg leading-relaxed text-muted">{found.lesson.summary}</p>}
        {video ? (
          <div className="flex flex-col gap-2">
            <div className="relative aspect-video w-full overflow-hidden rounded-[5px] bg-navy shadow-[0_18px_40px_-28px_rgba(25,17,46,.6)]">
              <iframe src={video.embedUrl} title={`Video: ${found.lesson.title}`} className="absolute inset-0 size-full border-0" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
            </div>
            {video.provider !== "bunny" && <a href={found.lesson.videoUrl!} target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted hover:text-accent">Open video in a new tab <ExternalIcon className="size-3.5" /></a>}
          </div>
        ) : (
          found.lesson.videoUrl && <a href={found.lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 rounded-[5px] bg-navy px-5 py-4 text-white hover:bg-[#24354b]"><span><span className="block font-semibold">Watch lesson video</span><span className="text-sm text-white/65">Opens in a new tab</span></span><ExternalIcon className="size-5" /></a>
        )}
        <Card className="min-h-80">{found.lesson.content ? <Markdown size="lg">{found.lesson.content}</Markdown> : <p className="text-muted">This lesson has no written content yet.</p>}</Card>
        {quiz && quizState && (
          <Card title="Quiz">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <p className="text-body">{quizQuestionCount} question{quizQuestionCount === 1 ? "" : "s"} · pass mark {quiz.passPercent}%{quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} min` : ""}{quiz.requiredToComplete ? " · required to complete the lesson" : ""}</p>
                <p className="text-sm text-muted">{quizState.attemptsUsed ? <>Best score {quizState.best}% {quizState.passed ? <Badge tone="green">Passed</Badge> : <Badge tone="amber">Not passed yet</Badge>}</> : "Not attempted yet"}{quizState.attemptsLeft !== null && ` · ${quizState.attemptsLeft} attempt${quizState.attemptsLeft === 1 ? "" : "s"} left`}</p>
              </div>
              {quizState.attemptsLeft === 0
                ? <Link href={`/dashboard/cohorts/${cohortId}/learn/${lessonId}/quiz`} className="inline-flex h-10 items-center rounded-lg border border-edge-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-page">View results</Link>
                : <form action={startQuiz.bind(null, cohortId, lessonId)}><button type="submit" className={`inline-flex h-10 cursor-pointer items-center rounded-lg px-4 text-sm font-semibold ${quizState.passed ? "border border-edge-strong bg-white text-ink hover:bg-page" : "bg-accent text-white hover:bg-accent-dark"}`}>{quizState.passed ? "Retake quiz" : quizState.attemptsUsed ? "Try again" : "Start quiz"}</button></form>}
            </div>
          </Card>
        )}
        {buddy && (
          <Card title="Study buddy">
            <AiChat
              send={askLessonBuddy.bind(null, cohortId, lessonId)}
              intro={`Hi! I've read "${found.lesson.title}". Ask me to explain anything, give an example, or quiz you.`}
              placeholder="Ask about this lesson…"
              suggestions={["Explain this lesson simply", "Give me a real-world example", "Quiz me with 3 questions"]}
            />
          </Card>
        )}
        {found.lesson.resourceUrl && <a href={found.lesson.resourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[5px] border border-edge bg-white p-4 font-semibold text-accent hover:border-accent-muted"><LinkIcon className="size-5" /> {found.lesson.resourceLabel || "Open lesson resource"}<ExternalIcon className="ml-auto size-4" /></a>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          {previous ? <Link href={`/dashboard/cohorts/${cohortId}/learn/${previous.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-edge-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-page"><ArrowLeft className="size-4" /> Previous</Link> : <span />}
          {quizBlocks ? <span className="text-sm font-semibold text-amber-800">Pass the quiz to complete this lesson</span> : complete ? <ActionButton action={setLessonComplete.bind(null, cohortId, lessonId, false)} doneText="Marked incomplete"><CheckCircleIcon className="size-4 text-emerald-700" /> Completed</ActionButton> : <ActionButton action={setLessonComplete.bind(null, cohortId, lessonId, true)} variant="primary" doneText="Lesson completed"><CheckCircleIcon className="size-4" /> Mark complete</ActionButton>}
          {next ? <Link href={`/dashboard/cohorts/${cohortId}/learn/${next.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-edge-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-page">Next <ArrowRight className="size-4" /></Link> : <Link href={`/dashboard/cohorts/${cohortId}/learn`} className="text-sm font-semibold text-accent">Back to course</Link>}
        </div>
      </main>
      <aside className="sticky top-24 hidden xl:block"><Card title="In this course"><ol className="flex flex-col gap-1">{all.map((row, i) => <li key={row.lesson.id}><Link href={`/dashboard/cohorts/${cohortId}/learn/${row.lesson.id}`} className={`block rounded-[5px] px-3 py-2.5 text-sm ${row.lesson.id === lessonId ? "bg-accent-soft font-semibold text-accent" : "text-body hover:bg-panel"}`}><span className="mr-2 text-xs text-muted">{i + 1}</span>{row.lesson.title}</Link></li>)}</ol></Card></aside>
    </div>
  </>;
}
