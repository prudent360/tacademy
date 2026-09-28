import type { Metadata } from "next";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { createCohort } from "@/app/actions/admin";
import { CohortForm } from "@/components/admin/cohort-form";
import { Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courses, users } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "New cohort" };

export default async function NewCohortPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const courseId = idParam((await searchParams).course ?? "");
  if (!courseId) notFound();
  const db = await getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) notFound();
  const [settings, staff] = await Promise.all([getSettings(), db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(inArray(users.role, ["instructor", "admin"]))]);
  return (
    <>
      <PageHeader back={{ href: `/admin/courses/${courseId}`, label: course.title }} title="New cohort" description={course.title} />
      <Card><CohortForm action={createCohort.bind(null, courseId)} instructors={staff} assigned={[]} currencies={settings.currencies} internship={course.kind === "internship"} /></Card>
    </>
  );
}
