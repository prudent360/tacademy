import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { createCourse } from "@/app/actions/admin";
import { CourseForm } from "@/components/admin/course-form";
import { Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { aiAvailable } from "@/lib/ai";

export const metadata: Metadata = { title: "New internship" };

export default async function NewInternshipPage() {
  const [ai, linkable] = await Promise.all([
    aiAvailable("writing"),
    (await getDb()).select({ id: courses.id, title: courses.title }).from(courses).where(eq(courses.kind, "course")).orderBy(asc(courses.sortOrder), asc(courses.title)),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/admin/internships", label: "Internships" }} title="New internship" description="Create the programme first, then add one or more intakes with dates and fees." />
      <Card><CourseForm action={createCourse} ai={ai} kind="internship" linkable={linkable} /></Card>
    </>
  );
}
