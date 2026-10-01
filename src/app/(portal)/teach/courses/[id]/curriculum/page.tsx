import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CurriculumBuilder } from "@/components/admin/curriculum-builder";
import { Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { requireCourseEditor } from "@/lib/auth";
import { curriculumFor } from "@/lib/curriculum";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Curriculum" };

/** Instructors build the curriculum of a course they teach (admins use the course page). */
export default async function TeachCurriculumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cohort?: string }> }) {
  const [{ id: raw }, { cohort }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const user = await requireCourseEditor(id);
  const [course] = await (await getDb()).select({ title: courses.title }).from(courses).where(eq(courses.id, id));
  if (!course) notFound();
  const cohortId = idParam(cohort ?? "") ?? undefined;
  return <>
    <PageHeader
      back={cohortId ? { href: `/teach/cohorts/${cohortId}?tab=lessons`, label: "Lessons" } : { href: "/teach", label: "Teaching" }}
      title="Curriculum"
      description={`${course.title} · shared by every cohort of this course`}
    />
    <Card>
      <CurriculumBuilder courseId={id} modules={await curriculumFor(id)} lessonHref={`/teach/lessons/{id}${cohortId ? `?cohort=${cohortId}` : ""}`} canDelete={user.role === "admin"} />
    </Card>
  </>;
}
