import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { createCourse } from "@/app/actions/admin";
import { CourseForm } from "@/components/admin/course-form";
import { Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { aiAvailable } from "@/lib/ai";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "New internship" };

export default async function NewInternshipPage() {
  await requirePermission("courses.manage");
  const [ai, linkable] = await Promise.all([
    aiAvailable("writing"),
    (await getDb()).select({ id: courses.id, title: courses.title }).from(courses).where(eq(courses.kind, "course")).orderBy(asc(courses.sortOrder), asc(courses.title)),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/admin/internships", label: "Internships" }} title="New internship" description="Create the programme first, then add one or more intakes with dates and fees." />
      <div className="rounded-[5px] border border-accent-muted/40 bg-accent-soft px-4 py-3 text-sm text-body"><strong className="text-ink">Where&apos;s the price?</strong> Fees belong to each intake, because intakes can run at different times and prices. Save this programme first; on the next page click <strong className="text-ink">Add intake</strong> to set its dates, places and fee (with an optional deposit or registration fee).</div>
      <Card><CourseForm action={createCourse} ai={ai} kind="internship" linkable={linkable} /></Card>
    </>
  );
}
