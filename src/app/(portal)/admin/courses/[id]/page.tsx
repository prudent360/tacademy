import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ProgrammeAdmin } from "@/components/admin/programme-admin";
import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { idParam } from "@/lib/validation";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit course" };

export default async function EditCoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requirePermission("courses.manage");
  const [{ id: raw }, { created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const [course] = await (await getDb()).select().from(courses).where(eq(courses.id, id));
  if (!course) notFound();
  if (course.kind === "internship") redirect(`/admin/internships/${id}`);
  return <ProgrammeAdmin course={course} created={Boolean(created)} />;
}
