import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { UsersIcon } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader, Pagination, PersonCell, TableToolbar } from "@/components/ui";
import { getDb } from "@/db";
import { APPLICATION_STATUSES, instructorApplications, type ApplicationStatus } from "@/db/schema";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/applications";
import { countryByCode, flag } from "@/lib/countries";
import { relativeTime } from "@/lib/time";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Instructor applications" };

const PAGE_SIZE = 25;

type Search = { status?: string; q?: string; page?: string };

export default async function InstructorApplicationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("instructors.review");
  const params = await searchParams;
  const status = APPLICATION_STATUSES.find((s) => s === params.status);
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const filters: SQL[] = [];
  if (status) filters.push(eq(instructorApplications.status, status));
  if (q) filters.push(or(ilike(instructorApplications.name, `%${q}%`), ilike(instructorApplications.email, `%${q}%`), ilike(instructorApplications.expertise, `%${q}%`))!);
  const where = filters.length ? and(...filters) : undefined;
  const db = await getDb();
  const [rows, [{ n: total }], byStatus] = await Promise.all([
    db.select().from(instructorApplications).where(where).orderBy(desc(instructorApplications.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(instructorApplications).where(where),
    db.select({ status: instructorApplications.status, n: count() }).from(instructorApplications).groupBy(instructorApplications.status),
  ]);
  const statusCount = (s: ApplicationStatus) => byStatus.find((b) => b.status === s)?.n ?? 0;
  const url = (next: Partial<Search>) => {
    const merged = { status, q: q || undefined, page: undefined as string | undefined, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/admin/instructor-applications?${qs}` : "/admin/instructor-applications";
  };

  return (
    <>
      <PageHeader title="Instructor applications" description="People who applied through the “Become an instructor” page. Review, shortlist, then accept (they get an instructor account) or decline." />
      <TableToolbar
        action="/admin/instructor-applications"
        q={q}
        placeholder="Search by name, email or area…"
        hidden={{ status }}
        filters={[
          { label: "All", href: url({ status: undefined }), active: !status, count: byStatus.reduce((a, b) => a + b.n, 0) },
          ...APPLICATION_STATUSES.map((s) => ({ label: STATUS_LABELS[s], href: url({ status: s }), active: status === s, count: statusCount(s) })),
        ]}
      />
      {rows.length ? (
        <>
          <DataTable>
            <thead><tr><th>Applicant</th><th>Would teach</th><th>Country</th><th>Applied</th><th>Status</th><th className="text-right" /></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><PersonCell name={a.name} email={a.email} href={`/admin/instructor-applications/${a.id}`} /></td>
                  <td className="text-body">{a.expertise}<span className="mt-1 block text-xs text-muted">{a.currentRole}</span><span className="mt-1 flex flex-wrap gap-1"><Badge>{a.yearsExperience}</Badge></span></td>
                  <td className="whitespace-nowrap text-body">{countryByCode(a.country) ? `${flag(a.country)} ${countryByCode(a.country)!.name}` : a.country}</td>
                  <td className="whitespace-nowrap text-muted">{relativeTime(a.createdAt)}</td>
                  <td><Badge tone={STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</Badge></td>
                  <td className="text-right"><Link href={`/admin/instructor-applications/${a.id}`} className="inline-flex h-9 items-center rounded-lg border border-edge-strong bg-white px-3 text-sm font-semibold text-ink hover:bg-page">Review</Link></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} href={(n) => url({ page: String(n) })} />
        </>
      ) : (
        <EmptyState icon={UsersIcon} title={q || status ? "No applications match" : "No applications yet"}>{q || status ? "Try a different search or filter." : <>Applications from <Link href="/teach-with-us" className="font-semibold text-accent">/teach-with-us</Link> will appear here.</>}</EmptyState>
      )}
    </>
  );
}
