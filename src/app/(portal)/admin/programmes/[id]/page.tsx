import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteProgramme, updateProgramme } from "@/app/actions/programmes";
import { ProgrammeForm } from "@/components/admin/programme-form";
import { DeleteButton } from "@/components/forms";
import { ExternalIcon } from "@/components/icons";
import { Card, Notice, PageHeader, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { courses, programmes } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { programmeCourseMap } from "@/lib/programmes";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit programme" };

export default async function EditProgrammePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requirePermission("courses.manage");
  const [{ id: raw }, { created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const [[programme], settings, options, included] = await Promise.all([
    db.select().from(programmes).where(eq(programmes.id, id)),
    getSettings(),
    db.select({ id: courses.id, title: courses.title, published: courses.published, durationWeeks: courses.durationWeeks }).from(courses).where(eq(courses.kind, "course")).orderBy(asc(courses.sortOrder), asc(courses.title)),
    programmeCourseMap([id]),
  ]);
  if (!programme) notFound();
  const list = included.get(id) ?? [];
  const drafts = list.filter((c) => !c.published);
  return (
    <>
      <PageHeader back={{ href: "/admin/programmes", label: "Programmes" }} title={programme.title}
        actions={programme.published && <Link href={`/programmes/${programme.slug}`} target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View page</Link>} />
      {created && <Notice>Programme created{programme.published ? "." : ". Publish it when it's ready to appear on the website."}</Notice>}
      {drafts.length > 0 && <Notice tone="amber">{drafts.map((c) => c.title).join(", ")} {drafts.length === 1 ? "is" : "are"} still a draft, so the website leaves {drafts.length === 1 ? "it" : "them"} out of this programme until published.</Notice>}
      <Card><ProgrammeForm action={updateProgramme.bind(null, id)} programme={programme} courses={options} included={list.map((c) => c.id)} currencies={settings.currencies} /></Card>
      <div className="flex justify-end"><DeleteButton action={deleteProgramme.bind(null, id)} label="Delete programme" /></div>
    </>
  );
}
