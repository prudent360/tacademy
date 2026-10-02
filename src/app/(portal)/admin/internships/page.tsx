import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, eq, inArray } from "drizzle-orm";
import { BriefcaseIcon } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courses, internshipApplications, internshipCourses } from "@/db/schema";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Internships" };

export default async function AdminInternshipsPage() {
  await requirePermission("courses.manage");
  const db = await getDb();
  const rows = await db.select().from(courses).where(eq(courses.kind, "internship")).orderBy(asc(courses.sortOrder), asc(courses.title));
  const ids = rows.map((r) => r.id);
  const [intakes, links, pending] = await Promise.all([
    ids.length ? db.select({ courseId: cohorts.courseId, n: count() }).from(cohorts).where(inArray(cohorts.courseId, ids)).groupBy(cohorts.courseId) : [],
    ids.length ? db.select({ internshipId: internshipCourses.internshipId, title: courses.title }).from(internshipCourses).innerJoin(courses, eq(courses.id, internshipCourses.courseId)).where(inArray(internshipCourses.internshipId, ids)) : [],
    db.select({ area: internshipApplications.skillArea, n: count() }).from(internshipApplications).where(inArray(internshipApplications.status, ["new", "shortlisted"])).groupBy(internshipApplications.skillArea),
  ]);
  return (
    <>
      <PageHeader title="Internships" description="Internship programmes, each with its own intakes. Link the courses whose graduates join free."
        actions={<><Link href="/admin/applications" className={buttonClass.secondary}>Applications</Link><Link href="/admin/internships/new" className={buttonClass.primary}>New internship</Link></>} />
      {rows.length ? (
        <DataTable>
          <thead><tr><th>Internship</th><th>Free for graduates of</th><th>Intakes</th><th>To review</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const linked = links.filter((l) => l.internshipId === r.id).map((l) => l.title);
              const waiting = pending.find((p) => p.area === r.title)?.n ?? 0;
              return (
                <tr key={r.id}>
                  <td><Link href={`/admin/internships/${r.id}`} className="font-semibold text-ink hover:text-accent">{r.title}</Link><p className="text-sm text-muted">/courses/{r.slug}</p></td>
                  <td className="text-sm text-body">{linked.length ? linked.join(", ") : <span className="text-muted">Any course</span>}</td>
                  <td>{intakes.find((x) => x.courseId === r.id)?.n ?? 0}</td>
                  <td>{waiting ? <Link href={`/admin/applications?q=${encodeURIComponent(r.title)}`}><Badge tone="accent">{waiting} new</Badge></Link> : <span className="text-muted">–</span>}</td>
                  <td>{r.published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState icon={BriefcaseIcon} title="No internships yet" action={<Link href="/admin/internships/new" className={buttonClass.primary}>Create your first internship</Link>}>Create an internship programme, link the courses that lead into it, then add intakes.</EmptyState>
      )}
    </>
  );
}
