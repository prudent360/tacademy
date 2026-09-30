import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { createLesson } from "@/app/actions/learning";
import { LessonForm } from "@/components/admin/learning-forms";
import { draftLesson } from "@/app/actions/ai";
import { aiAvailable } from "@/lib/ai";
import { Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courseModules, courses } from "@/db/schema";
import { requireCourseEditor } from "@/lib/auth";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "New lesson" };

export default async function NewTeachLessonPage({ searchParams }: { searchParams: Promise<{ module?: string; cohort?: string }> }) {
  const { module: rawModule, cohort } = await searchParams;
  const moduleId = idParam(rawModule ?? "");
  if (!moduleId) notFound();
  const [found] = await (await getDb()).select({ module: courseModules, course: courses }).from(courseModules).innerJoin(courses, eq(courses.id, courseModules.courseId)).where(eq(courseModules.id, moduleId));
  if (!found) notFound();
  await requireCourseEditor(found.course.id);
  const cohortId = idParam(cohort ?? "") ?? undefined;
  const ai = await aiAvailable("writing");
  return <>
    <PageHeader back={{ href: cohortId ? `/teach/cohorts/${cohortId}?tab=lessons` : "/teach", label: "Lessons" }} title="New lesson" description={`${found.course.title} · ${found.module.title}`} />
    <Card><LessonForm action={createLesson.bind(null, moduleId)} cohortId={cohortId} draft={ai ? draftLesson.bind(null, moduleId, null) : undefined} /></Card>
  </>;
}
