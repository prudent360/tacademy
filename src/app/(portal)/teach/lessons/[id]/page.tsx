import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { updateLesson } from "@/app/actions/learning";
import { LessonForm } from "@/components/admin/learning-forms";
import { draftLesson } from "@/app/actions/ai";
import { aiAvailable } from "@/lib/ai";
import { Card, Notice, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courseModules, courses, lessons } from "@/db/schema";
import { requireCourseEditor } from "@/lib/auth";
import { idParam } from "@/lib/validation";
import { lessonVideo } from "@/lib/video";
import { QuizEditor } from "@/components/quiz/quiz-editor";

export const metadata: Metadata = { title: "Edit lesson" };

/** Instructors edit lessons for the courses they teach (admins use /admin/lessons). */
export default async function TeachLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; cohort?: string }> }) {
  const [{ id: raw }, { created, cohort }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const [found] = await (await getDb()).select({ lesson: lessons, module: courseModules, course: courses }).from(lessons).innerJoin(courseModules, eq(courseModules.id, lessons.moduleId)).innerJoin(courses, eq(courses.id, courseModules.courseId)).where(eq(lessons.id, id));
  if (!found) notFound();
  await requireCourseEditor(found.course.id);
  const cohortId = idParam(cohort ?? "") ?? undefined;
  const video = await lessonVideo(found.lesson.videoUrl);
  const ai = await aiAvailable("writing");
  return <>
    <PageHeader back={{ href: cohortId ? `/teach/cohorts/${cohortId}?tab=lessons` : "/teach", label: "Lessons" }} title={found.lesson.title} description={`${found.course.title} · ${found.module.title}`} />
    {created && <Notice>Lesson created. Add the video and content, then tick “Published for students” when it&apos;s ready.</Notice>}
    {found.lesson.videoUrl && !video && <Notice tone="amber">This video link can&apos;t be played inside the lesson, so students get a button that opens it instead. Bunny Stream, YouTube, Vimeo and Loom links play inline.</Notice>}
    <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Card><LessonForm action={updateLesson.bind(null, id)} lesson={found.lesson} cohortId={cohortId} draft={ai ? draftLesson.bind(null, found.module.id, id) : undefined} /></Card>
      {video && (
        <Card title="Video preview">
          <div className="relative aspect-video w-full overflow-hidden rounded-[5px] bg-navy">
            <iframe src={video.embedUrl} title={`Video: ${found.lesson.title}`} className="absolute inset-0 size-full border-0" loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        </Card>
      )}
    </div>
    <QuizEditor lessonId={id} />
  </>;
}
