import type { Metadata } from "next";
import Link from "next/link";
import { count, desc } from "drizzle-orm";
import { DownloadIcon } from "@/components/icons";
import { DataTable, EmptyState, PageHeader, Pagination, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { curriculumRequests } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { formatDateTime } from "@/lib/time";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Curriculum requests" };

const PAGE_SIZE = 50;

export default async function CurriculumRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("leads.view");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const db = await getDb();
  const [settings, [{ total }], rows] = await Promise.all([
    getSettings(),
    db.select({ total: count() }).from(curriculumRequests),
    db.select().from(curriculumRequests).orderBy(desc(curriculumRequests.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
  ]);
  return <>
    <PageHeader
      title="Curriculum requests"
      description="People who downloaded a course curriculum from the course page. Upload a curriculum document on a course to turn this on."
      actions={total > 0 && <a href="/api/admin/leads/export" className={buttonClass.secondary}><DownloadIcon className="size-4" /> Export CSV</a>}
    />
    {rows.length ? <>
      <DataTable><thead><tr><th>Date</th><th>Name</th><th>Email</th><th>Phone</th><th>Course</th></tr></thead><tbody>{rows.map((row) => (
        <tr key={row.id}>
          <td className="whitespace-nowrap text-body">{formatDateTime(row.createdAt, settings.timezone, { zone: false })}</td>
          <td className="font-semibold text-ink">{row.name}</td>
          <td><a href={`mailto:${row.email}`} className="text-accent hover:underline">{row.email}</a></td>
          <td className="whitespace-nowrap"><a href={`tel:${row.phone.replace(/\s/g, "")}`} className="text-body hover:text-accent">{row.phone}</a></td>
          <td>{row.courseId ? <Link href={`/admin/courses/${row.courseId}`} className="text-body hover:text-accent">{row.courseTitle}</Link> : row.courseTitle}</td>
        </tr>
      ))}</tbody></DataTable>
      <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} href={(n) => `/admin/leads?page=${n}`} />
    </> : <EmptyState title="No requests yet" icon={DownloadIcon}>When visitors request a curriculum from a course page, their details appear here.</EmptyState>}
  </>;
}
