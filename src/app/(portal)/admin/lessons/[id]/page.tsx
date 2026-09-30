import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteLesson, updateLesson } from "@/app/actions/learning";
import { LessonForm } from "@/components/admin/learning-forms";
import { draftLesson } from "@/app/actions/ai";
import { aiAvailable } from "@/lib/ai";
import { DeleteButton } from "@/components/forms";
import { Card, Notice, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courseModules, courses, lessons } from "@/db/schema";
import { idParam } from "@/lib/validation";
import { QuizEditor } from "@/components/quiz/quiz-editor";

export const metadata: Metadata = { title: "Edit lesson" };

export default async function EditLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id: raw }, { created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const [found] = await (await getDb()).select({ lesson: lessons, module: courseModules, course: courses }).from(lessons).innerJoin(courseModules, eq(courseModules.id, lessons.moduleId)).innerJoin(courses, eq(courses.id, courseModules.courseId)).where(eq(lessons.id, id));
  if (!found) notFound();
  const ai = await aiAvailable("writing");
  return <>
    <PageHeader back={{ href: `/admin/modules/${found.module.id}`, label: found.module.title }} title={found.lesson.title} description={found.course.title} />
    {created && <Notice>Lesson created. Add the content and publish it when it is ready.</Notice>}
    <Card><LessonForm action={updateLesson.bind(null, id)} lesson={found.lesson} draft={ai ? draftLesson.bind(null, found.module.id, id) : undefined} /></Card>
    <QuizEditor lessonId={id} />
    <div className="flex justify-end"><DeleteButton action={deleteLesson.bind(null, id)} label="Delete lesson" /></div>
  </>;
}
