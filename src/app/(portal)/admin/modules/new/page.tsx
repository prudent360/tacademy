import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { createModule } from "@/app/actions/learning";
import { ModuleForm } from "@/components/admin/learning-forms";
import { Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "New module" };

export default async function NewModulePage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const { course: raw } = await searchParams;
  const courseId = idParam(raw ?? "");
  if (!courseId) notFound();
  const [course] = await (await getDb()).select({ title: courses.title }).from(courses).where(eq(courses.id, courseId));
  if (!course) notFound();
  return <><PageHeader back={{ href: `/admin/courses/${courseId}`, label: course.title }} title="New learning module" description="Modules are reusable across every cohort of this course." /><Card><ModuleForm action={createModule.bind(null, courseId)} /></Card></>;
}
