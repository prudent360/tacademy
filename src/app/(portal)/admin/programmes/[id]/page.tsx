import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteProgramme, updateProgramme } from "@/app/actions/programmes";
import { ProgrammeForm } from "@/components/admin/programme-form";
import { DeleteButton } from "@/components/forms";
import { ExternalIcon } from "@/components/icons";
import { Badge, Card, DataTable, Notice, PageHeader, PersonCell, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { courses, programmeEnrollments, programmes, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { instalmentStatus } from "@/lib/programme-enrolment";
import { programmeCourseMap } from "@/lib/programmes";
import { idParam } from "@/lib/validation";
import { formatDateOnly } from "@/lib/time";

export const metadata: Metadata = { title: "Edit programme" };

export default async function EditProgrammePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; inUse?: string }> }) {
  await requirePermission("courses.manage");
  const [{ id: raw }, { created, inUse }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const [[programme], settings, options, included] = await Promise.all([
    db.select().from(programmes).where(eq(programmes.id, id)),
    getSettings(),
    db.select({ id: courses.id, title: courses.title, published: courses.published, durationWeeks: courses.durationWeeks }).from(courses).where(eq(courses.kind, "course")).orderBy(asc(courses.sortOrder), asc(courses.title)),
    programmeCourseMap([id]),
  ]);
  const students = await db.select({ enrolment: programmeEnrollments, user: users }).from(programmeEnrollments).innerJoin(users, eq(users.id, programmeEnrollments.userId))
    .where(and(eq(programmeEnrollments.programmeId, id), eq(programmeEnrollments.status, "active"))).orderBy(desc(programmeEnrollments.activatedAt));
  const withStatus = await Promise.all(students.map(async (row) => ({ ...row, status: await instalmentStatus(row.enrolment) })));
  if (!programme) notFound();
  const list = included.get(id) ?? [];
  const drafts = list.filter((c) => !c.published);
  return (
    <>
      <PageHeader back={{ href: "/admin/programmes", label: "Programmes" }} title={programme.title}
        actions={programme.published && <Link href={`/programmes/${programme.slug}`} target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View page</Link>} />
      {created && <Notice>Programme created{programme.published ? "." : ". Publish it when it's ready to appear on the website."}</Notice>}
      {inUse && <Notice tone="amber">This programme has students on it, so it can&apos;t be deleted. Untick Published to take it off the website instead.</Notice>}
      {drafts.length > 0 && <Notice tone="amber">{drafts.map((c) => c.title).join(", ")} {drafts.length === 1 ? "is" : "are"} still a draft, so the website leaves {drafts.length === 1 ? "it" : "them"} out of this programme until published.</Notice>}
      <Card title={`Students (${withStatus.length})`} padded={false}>
        {withStatus.length ? (
          <DataTable>
            <thead><tr><th>Student</th><th>Joined</th><th>Agreed fee</th><th>Instalments</th></tr></thead>
            <tbody>
              {withStatus.map(({ enrolment, user, status }) => (
                <tr key={enrolment.id}>
                  <td><PersonCell name={user.name} email={user.email} src={user.avatarUrl} gender={user.gender} href={`/admin/users/${user.id}`} /></td>
                  <td className="text-sm text-muted">{enrolment.activatedAt ? formatDateOnly(enrolment.activatedAt.toISOString().slice(0, 10)) : "–"}</td>
                  <td className="text-sm">{formatMoney(enrolment.total, enrolment.currency)}</td>
                  <td>{enrolment.instalmentCount > 1 ? <Badge tone={status.overdue ? "amber" : status.next ? "accent" : "green"}>{status.paid} of {enrolment.instalmentCount} paid{status.overdue ? " · overdue" : ""}</Badge> : <Badge tone="green">Paid in full</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : <p className="p-5 text-sm text-muted md:p-6">No students yet. They join from the programme page with “Enrol now”.</p>}
      </Card>
      <Card><ProgrammeForm action={updateProgramme.bind(null, id)} programme={programme} courses={options} included={list.map((c) => c.id)} currencies={settings.currencies} /></Card>
      <div className="flex justify-end"><DeleteButton action={deleteProgramme.bind(null, id)} label="Delete programme" /></div>
    </>
  );
}
