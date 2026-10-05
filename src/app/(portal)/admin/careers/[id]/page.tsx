import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { deleteJob, setJobStatus } from "@/app/actions/careers";
import { JobForm } from "@/components/admin/job-form";
import { ActionButton, DeleteButton } from "@/components/forms";
import { ExternalIcon } from "@/components/icons";
import { Badge, buttonClass, Card, Notice, PageHeader, PersonCell } from "@/components/ui";
import { getDb } from "@/db";
import { jobApplications, jobOpenings } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { JOB_APPLICATION_LABEL, JOB_APPLICATION_TONE, JOB_STATUS_LABEL, JOB_STATUS_TONE } from "@/lib/careers";
import { relativeTime } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit role" };

export default async function EditJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requirePermission("careers.manage");
  const [{ id: raw }, { created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const [job] = await db.select().from(jobOpenings).where(eq(jobOpenings.id, id));
  if (!job) notFound();
  const [applications, departmentRows] = await Promise.all([
    db.select().from(jobApplications).where(eq(jobApplications.jobId, id)).orderBy(desc(jobApplications.createdAt)).limit(8),
    db.selectDistinct({ d: jobOpenings.department }).from(jobOpenings),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/careers", label: "Careers" }}
        title={job.title}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge> /careers/{job.slug}</span>}
        actions={<>
          {job.status !== "draft" && <Link href={`/careers/${job.slug}`} target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View on site</Link>}
          {job.status === "open" ? <ActionButton action={setJobStatus.bind(null, id, "closed")} pendingText="Closing…">Close role</ActionButton> : <ActionButton action={setJobStatus.bind(null, id, "open")} variant="primary" pendingText="Opening…">{job.status === "draft" ? "Publish" : "Reopen"}</ActionButton>}
        </>}
      />
      {created && <Notice>Role created as a {job.status === "open" ? "live role" : "draft"}. {job.status === "draft" && "Click Publish when it's ready."}</Notice>}
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <JobForm job={job} departments={departmentRows.map((r) => r.d).filter(Boolean)} />
        <div className="flex flex-col gap-6 xl:sticky xl:top-24">
          <Card title="Applicants" action={applications.length ? <Link href={`/admin/careers/applications?job=${id}`} className="text-sm font-semibold text-accent-ink">View all</Link> : undefined} padded={false}>
            {applications.length ? (
              <ul className="divide-y divide-line">
                {applications.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0"><PersonCell name={a.name} email={relativeTime(a.createdAt)} href={`/admin/careers/applications/${a.id}`} /></div>
                    <Badge tone={JOB_APPLICATION_TONE[a.status]}>{JOB_APPLICATION_LABEL[a.status]}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="p-5 text-sm text-muted">{job.applyMethod === "form" ? "No applications yet." : `People apply ${job.applyMethod === "email" ? "by email" : "on another website"}, so applications don't arrive here.`}</p>}
          </Card>
          <Card title="Delete this role">
            <p className="mb-4 text-sm text-muted">Removes it from the Careers page. Applications are kept. To stop applications but keep the page, close the role instead.</p>
            <DeleteButton action={deleteJob.bind(null, id)} label="Delete role" />
          </Card>
        </div>
      </div>
    </>
  );
}
