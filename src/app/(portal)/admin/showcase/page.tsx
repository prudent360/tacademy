import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { setShowcaseHidden } from "@/app/actions/showcase";
import { ActionButton } from "@/components/forms";
import { AwardIcon, ExternalIcon } from "@/components/icons";
import { Badge, buttonClass, DataTable, EmptyState, PageHeader, PersonCell } from "@/components/ui";
import { getDb } from "@/db";
import { courses, showcaseProjects, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { SHOWCASE_STATUS_LABEL, SHOWCASE_STATUS_TONE } from "@/lib/showcase";
import { relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Project showcase" };

export default async function AdminShowcasePage() {
  await requirePermission("showcase.manage");
  const rows = await (await getDb()).select({ project: showcaseProjects, student: { name: users.name, email: users.email }, courseTitle: courses.title }).from(showcaseProjects).innerJoin(users, eq(users.id, showcaseProjects.userId)).leftJoin(courses, eq(courses.id, showcaseProjects.courseId)).orderBy(desc(showcaseProjects.updatedAt));
  return (
    <>
      <PageHeader title="Project showcase" description="Graded work that instructors invited to the public Projects page. Students choose whether to publish; you can hide anything that shouldn't be there." actions={<Link href="/projects" target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View Projects page</Link>} />
      {rows.length ? (
        <DataTable>
          <thead><tr><th>Project</th><th>Student</th><th>Status</th><th>Updated</th><th className="text-right"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {rows.map(({ project: p, student, courseTitle }) => (
              <tr key={p.id}>
                <td>{p.status === "published" ? <Link href={`/projects/${p.slug}`} target="_blank" className="font-semibold text-ink hover:text-accent-ink">{p.title}</Link> : <span className="font-semibold text-ink">{p.title}</span>}{courseTitle && <span className="mt-0.5 block text-xs text-muted">{courseTitle}</span>}</td>
                <td><PersonCell name={student.name} email={student.email} /></td>
                <td><Badge tone={SHOWCASE_STATUS_TONE[p.status]}>{SHOWCASE_STATUS_LABEL[p.status]}</Badge></td>
                <td className="whitespace-nowrap text-muted">{relativeTime(p.updatedAt)}</td>
                <td className="text-right">{p.status === "hidden" ? <ActionButton action={setShowcaseHidden.bind(null, p.id, false)} pendingText="Restoring…">Restore</ActionButton> : p.status === "published" ? <ActionButton action={setShowcaseHidden.bind(null, p.id, true)} variant="danger" pendingText="Hiding…">Hide</ActionButton> : null}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState icon={AwardIcon} title="Nothing in the showcase yet">Instructors invite strong graded submissions from the grading page (Teach › To grade › a submission › Project showcase).</EmptyState>
      )}
    </>
  );
}
