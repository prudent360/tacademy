import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { BriefcaseIcon, CheckCircleIcon, ClipboardIcon, ExternalIcon, PlusIcon, UsersIcon } from "@/components/icons";
import { StatTile } from "@/components/portal/dash";
import { Badge, buttonClass, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { jobApplications, jobOpenings } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { isAccepting, JOB_MODE_LABEL, JOB_STATUS_LABEL, JOB_STATUS_TONE, JOB_TYPE_LABEL } from "@/lib/careers";
import { formatDateOnly, relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Careers" };

export default async function AdminCareersPage() {
  await requirePermission("careers.manage");
  const db = await getDb();
  const [jobs, perJob, byStatus] = await Promise.all([
    db.select().from(jobOpenings).orderBy(asc(jobOpenings.status), asc(jobOpenings.sortOrder), desc(jobOpenings.createdAt)),
    db.select({ jobId: jobApplications.jobId, status: jobApplications.status, n: count() }).from(jobApplications).groupBy(jobApplications.jobId, jobApplications.status),
    db.select({ status: jobApplications.status, n: count() }).from(jobApplications).where(inArray(jobApplications.status, ["new", "interview", "hired"])).groupBy(jobApplications.status),
  ]);
  const [{ open }] = await db.select({ open: count() }).from(jobOpenings).where(eq(jobOpenings.status, "open"));
  const stat = (s: string) => byStatus.find((b) => b.status === s)?.n ?? 0;
  const counts = (jobId: number) => {
    const rows = perJob.filter((r) => r.jobId === jobId);
    return { total: rows.reduce((a, r) => a + r.n, 0), fresh: rows.find((r) => r.status === "new")?.n ?? 0 };
  };
  // Open roles first, then drafts, then closed.
  const order = { open: 0, draft: 1, closed: 2 } as const;
  jobs.sort((a, b) => order[a.status] - order[b.status]);

  return (
    <>
      <PageHeader
        title="Careers"
        description="Roles on your public Careers page. Draft a role, open it when it's ready, and review applicants under Applications."
        actions={<>
          <Link href="/careers" target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View Careers page</Link>
          <Link href="/admin/careers/new" className={buttonClass.primary}><PlusIcon className="size-4" /> New role</Link>
        </>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Open roles" value={open} icon={BriefcaseIcon} tone="purple" />
        <StatTile label="New applications" value={stat("new")} icon={ClipboardIcon} tone="cyan" href="/admin/careers/applications?status=new" />
        <StatTile label="In interview" value={stat("interview")} icon={UsersIcon} tone="navy" href="/admin/careers/applications?status=interview" />
        <StatTile label="Hired" value={stat("hired")} icon={CheckCircleIcon} tone="green" href="/admin/careers/applications?status=hired" />
      </div>
      {jobs.length ? (
        <DataTable>
          <thead><tr><th>Role</th><th>Details</th><th>Applications</th><th>Status</th><th>Updated</th><th className="text-right"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {jobs.map((job) => {
              const c = counts(job.id);
              const expired = job.status === "open" && !isAccepting(job);
              return (
                <tr key={job.id}>
                  <td><Link href={`/admin/careers/${job.id}`} className="font-semibold text-ink hover:text-accent-ink">{job.title}</Link>{job.department && <span className="mt-0.5 block text-xs text-muted">{job.department}</span>}</td>
                  <td className="text-body">{JOB_TYPE_LABEL[job.employmentType]} · {JOB_MODE_LABEL[job.workMode]}{job.location && <span className="mt-0.5 block text-xs text-muted">{job.location}</span>}</td>
                  <td>{c.total ? <Link href={`/admin/careers/applications?job=${job.id}`} className="font-semibold text-ink hover:text-accent-ink">{c.total}</Link> : <span className="text-muted">0</span>}{c.fresh > 0 && <Badge tone="accent" className="ml-2">{c.fresh} new</Badge>}</td>
                  <td><Badge tone={expired ? "amber" : JOB_STATUS_TONE[job.status]}>{expired ? "Closing date passed" : JOB_STATUS_LABEL[job.status]}</Badge>{job.closesOn && !expired && job.status === "open" && <span className="mt-1 block text-xs text-muted">Closes {formatDateOnly(job.closesOn)}</span>}</td>
                  <td className="whitespace-nowrap text-muted">{relativeTime(job.updatedAt)}</td>
                  <td className="text-right"><Link href={`/admin/careers/${job.id}`} className="inline-flex h-9 items-center rounded-lg border border-edge-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-page">Edit</Link></td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState icon={BriefcaseIcon} title="No roles yet" action={<Link href="/admin/careers/new" className={buttonClass.primary}><PlusIcon className="size-4" /> Post your first role</Link>}>Roles you open appear on the public Careers page, where people can apply with their CV.</EmptyState>
      )}
    </>
  );
}
