import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { BriefcaseIcon, DownloadIcon } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader, Pagination, PersonCell, TableToolbar, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { APPLICATION_STATUSES, internshipApplications, type ApplicationStatus } from "@/db/schema";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/applications";
import { countryByCode, flag } from "@/lib/countries";
import { relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Internship applications" };

const PAGE_SIZE = 25;

type Search = { status?: string; q?: string; page?: string };

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const status = APPLICATION_STATUSES.find((s) => s === params.status);
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const filters: SQL[] = [];
  if (status) filters.push(eq(internshipApplications.status, status));
  if (q) filters.push(or(ilike(internshipApplications.name, `%${q}%`), ilike(internshipApplications.email, `%${q}%`), ilike(internshipApplications.skillArea, `%${q}%`))!);
  const where = filters.length ? and(...filters) : undefined;
  const db = await getDb();
  const [rows, [{ n: total }], byStatus] = await Promise.all([
    db.select().from(internshipApplications).where(where).orderBy(desc(internshipApplications.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(internshipApplications).where(where),
    db.select({ status: internshipApplications.status, n: count() }).from(internshipApplications).groupBy(internshipApplications.status),
  ]);
  const statusCount = (s: ApplicationStatus) => byStatus.find((b) => b.status === s)?.n ?? 0;
  const url = (next: Partial<Search>) => {
    const merged = { status, q: q || undefined, page: undefined as string | undefined, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/admin/applications?${qs}` : "/admin/applications";
  };

  return (
    <>
      <PageHeader title="Internship applications" description="Applications from the “Join our internship programme” form. Review, shortlist, then accept (they're emailed a link to enrol) or decline."
        actions={<a href={`/api/admin/applications/export${status ? `?status=${status}` : ""}`} className={buttonClass.secondary}><DownloadIcon className="size-4" /> Export CSV</a>} />
      <TableToolbar
        action="/admin/applications"
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
            <thead><tr><th>Applicant</th><th>Area</th><th>Country</th><th>Applied</th><th>Status</th><th className="text-right" /></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><PersonCell name={a.name} email={a.email} href={`/admin/applications/${a.id}`} /></td>
                  <td className="text-body">{a.skillArea}<span className="mt-1 flex flex-wrap gap-1">{a.graduateVerified && <Badge tone="green">Verified graduate</Badge>}{a.graduateClaimed && !a.graduateVerified && <Badge tone="amber">Says graduate (not found)</Badge>}<Badge>{a.experience}</Badge></span></td>
                  <td className="whitespace-nowrap text-body">{countryByCode(a.country) ? `${flag(a.country)} ${countryByCode(a.country)!.name}` : a.country}</td>
                  <td className="whitespace-nowrap text-muted">{relativeTime(a.createdAt)}</td>
                  <td><Badge tone={STATUS_TONE[a.status]}>{STATUS_LABELS[a.status]}</Badge></td>
                  <td className="text-right"><Link href={`/admin/applications/${a.id}`} className="inline-flex h-9 items-center rounded-lg border border-edge-strong bg-white px-3 text-sm font-semibold text-ink hover:bg-page">Review</Link></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} href={(n) => url({ page: String(n) })} />
        </>
      ) : (
        <EmptyState icon={BriefcaseIcon} title={q || status ? "No applications match" : "No applications yet"}>{q || status ? "Try a different search or filter." : <>Applications from <Link href="/internships/apply" className="font-semibold text-accent">/internships/apply</Link> will appear here.</>}</EmptyState>
      )}
    </>
  );
}
