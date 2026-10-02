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
import { idParam } from "@/lib/validation";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "New lesson" };

export default async function NewLessonPage({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  await requirePermission("courses.manage");
  const { module: raw } = await searchParams;
  const moduleId = idParam(raw ?? "");
  if (!moduleId) notFound();
  const [found] = await (await getDb()).select({ module: courseModules, course: courses }).from(courseModules).innerJoin(courses, eq(courses.id, courseModules.courseId)).where(eq(courseModules.id, moduleId));
  if (!found) notFound();
  const ai = await aiAvailable("writing");
  return <><PageHeader back={{ href: `/admin/courses/${found.course.id}#curriculum`, label: "Curriculum" }} title="New lesson" description={found.course.title} /><Card><LessonForm action={createLesson.bind(null, moduleId)} draft={ai ? draftLesson.bind(null, moduleId, null) : undefined} /></Card></>;
}
