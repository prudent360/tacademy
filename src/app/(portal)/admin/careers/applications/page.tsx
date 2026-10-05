import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { ClipboardIcon } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader, Pagination, PersonCell, TableToolbar } from "@/components/ui";
import { getDb } from "@/db";
import { JOB_APPLICATION_STATUSES, jobApplications, jobOpenings, type JobApplicationStatus } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { JOB_APPLICATION_LABEL, JOB_APPLICATION_TONE } from "@/lib/careers";
import { countryByCode, flag } from "@/lib/countries";
import { relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Job applications" };

const PAGE_SIZE = 25;
type Search = { status?: string; job?: string; q?: string; page?: string };

export default async function JobApplicationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("careers.manage");
  const params = await searchParams;
  const status = JOB_APPLICATION_STATUSES.find((s) => s === params.status);
  const jobId = Number(params.job) || undefined;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const filters: SQL[] = [];
  if (jobId) filters.push(eq(jobApplications.jobId, jobId));
  if (q) filters.push(or(ilike(jobApplications.name, `%${q}%`), ilike(jobApplications.email, `%${q}%`), ilike(jobApplications.jobTitle, `%${q}%`))!);
  const scope = filters.length ? and(...filters) : undefined;
  const where = status ? and(scope, eq(jobApplications.status, status)) : scope;
  const db = await getDb();
  const [rows, [{ n: total }], byStatus, jobs] = await Promise.all([
    db.select().from(jobApplications).where(where).orderBy(desc(jobApplications.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(jobApplications).where(where),
    db.select({ status: jobApplications.status, n: count() }).from(jobApplications).where(scope).groupBy(jobApplications.status),
    db.select({ id: jobOpenings.id, title: jobOpenings.title }).from(jobOpenings).orderBy(desc(jobOpenings.createdAt)),
  ]);
  const job = jobs.find((j) => j.id === jobId);
  const statusCount = (s: JobApplicationStatus) => byStatus.find((b) => b.status === s)?.n ?? 0;
  const url = (next: Partial<Search>) => {
    const merged = { status, job: jobId ? String(jobId) : undefined, q: q || undefined, page: undefined as string | undefined, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/admin/careers/applications?${qs}` : "/admin/careers/applications";
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/careers", label: "Careers" }}
        title={job ? `Applications: ${job.title}` : "Job applications"}
        description="Everyone who applied through the Careers page. Open an application to read it, move it through your hiring stages and keep notes."
      />
      {jobs.length > 1 && (
        <nav aria-label="Filter by role" className="flex flex-wrap gap-1.5">
          <Link href={url({ job: undefined })} className={`inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold ${!jobId ? "bg-ink text-white" : "bg-surface text-muted ring-1 ring-edge hover:text-ink"}`}>All roles</Link>
          {jobs.map((j) => <Link key={j.id} href={url({ job: String(j.id) })} className={`inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold ${jobId === j.id ? "bg-ink text-white" : "bg-surface text-muted ring-1 ring-edge hover:text-ink"}`}>{j.title}</Link>)}
        </nav>
      )}
      <TableToolbar
        action="/admin/careers/applications"
        q={q}
        placeholder="Search by name, email or role…"
        hidden={{ status, job: jobId ? String(jobId) : undefined }}
        filters={[
          { label: "All", href: url({ status: undefined }), active: !status, count: byStatus.reduce((a, b) => a + b.n, 0) },
          ...JOB_APPLICATION_STATUSES.map((s) => ({ label: JOB_APPLICATION_LABEL[s], href: url({ status: s }), active: status === s, count: statusCount(s) })),
        ]}
      />
      {rows.length ? (
        <>
          <DataTable>
            <thead><tr><th>Applicant</th><th>Role</th><th>Country</th><th>Can start</th><th>Applied</th><th>Stage</th><th className="text-right" /></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><PersonCell name={a.name} email={a.email} href={`/admin/careers/applications/${a.id}`} /></td>
                  <td className="text-body">{a.jobTitle}</td>
                  <td className="whitespace-nowrap text-body">{countryByCode(a.country) ? `${flag(a.country)} ${countryByCode(a.country)!.name}` : a.country || "–"}</td>
                  <td className="whitespace-nowrap text-muted">{a.noticePeriod || "–"}</td>
                  <td className="whitespace-nowrap text-muted">{relativeTime(a.createdAt)}</td>
                  <td><Badge tone={JOB_APPLICATION_TONE[a.status]}>{JOB_APPLICATION_LABEL[a.status]}</Badge></td>
                  <td className="text-right"><Link href={`/admin/careers/applications/${a.id}`} className="inline-flex h-9 items-center rounded-lg border border-edge-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-page">Review</Link></td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} href={(n) => url({ page: String(n) })} />
        </>
      ) : (
        <EmptyState icon={ClipboardIcon} title={q || status || jobId ? "No applications match" : "No applications yet"}>{q || status || jobId ? "Try a different search or filter." : "When people apply on the Careers page, they show here."}</EmptyState>
      )}
    </>
  );
}
