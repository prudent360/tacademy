import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { BookIcon } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courses } from "@/db/schema";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Courses" };

export default async function AdminCoursesPage() {
  await requirePermission("courses.manage");
  const db = await getDb();
  const [rows, counts] = await Promise.all([
    // Internships have their own section.
    db.select().from(courses).where(eq(courses.kind, "course")).orderBy(asc(courses.sortOrder), asc(courses.title)),
    db.select({ courseId: cohorts.courseId, n: count() }).from(cohorts).groupBy(cohorts.courseId),
  ]);
  return (
    <>
      <PageHeader title="Courses & cohorts" description="Each course can run many cohorts, each with its own dates, format, prices and instructors." actions={<Link href="/admin/courses/new" className={buttonClass.primary}>New course</Link>} />
      {rows.length ? (
        <DataTable>
          <thead><tr><th>Course</th><th>Category</th><th>Cohorts</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/courses/${c.id}`} className="font-semibold text-ink hover:text-accent-ink">{c.title}</Link><p className="text-sm text-muted">/courses/{c.slug}</p></td>
                <td className="text-muted">{c.category || "–"}</td>
                <td>{counts.find((x) => x.courseId === c.id)?.n ?? 0}</td>
                <td className="flex flex-wrap gap-1.5">{c.published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}{c.featured && <Badge tone="accent">Featured</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState icon={BookIcon} title="No courses yet" action={<Link href="/admin/courses/new" className={buttonClass.primary}>Create your first course</Link>} />
      )}
    </>
  );
}
