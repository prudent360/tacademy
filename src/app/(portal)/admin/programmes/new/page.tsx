import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { createProgramme } from "@/app/actions/programmes";
import { ProgrammeForm } from "@/components/admin/programme-form";
import { Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "New programme" };

export default async function NewProgrammePage() {
  await requirePermission("courses.manage");
  const [settings, options] = await Promise.all([
    getSettings(),
    (await getDb()).select({ id: courses.id, title: courses.title, published: courses.published, durationWeeks: courses.durationWeeks }).from(courses).where(eq(courses.kind, "course")).orderBy(asc(courses.sortOrder), asc(courses.title)),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/admin/programmes", label: "Programmes" }} title="New programme" description="Name the programme, choose its courses and set its duration and fee." />
      <Card><ProgrammeForm action={createProgramme} courses={options} currencies={settings.currencies} /></Card>
    </>
  );
}
