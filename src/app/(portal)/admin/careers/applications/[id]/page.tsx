import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { updateJobApplication } from "@/app/actions/careers";
import { ActionForm, Checkbox, Select, SubmitButton, Textarea } from "@/components/forms";
import { DownloadIcon, ExternalIcon, MailIcon, PhoneIcon } from "@/components/icons";
import { Badge, buttonClass, Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { JOB_APPLICATION_STATUSES, jobApplications } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { JOB_APPLICATION_LABEL, JOB_APPLICATION_TONE } from "@/lib/careers";
import { countryByCode, flag } from "@/lib/countries";
import { getSettings } from "@/lib/data";
import { formatDateTime } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Job application" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1 sm:grid-cols-[160px_1fr]"><dt className="text-sm text-muted">{label}</dt><dd className="text-[15px] text-ink">{children || <span className="text-muted">–</span>}</dd></div>;
}

export default async function JobApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("careers.manage");
  const id = idParam((await params).id);
  if (!id) notFound();
  const db = await getDb();
  const [a] = await db.select().from(jobApplications).where(eq(jobApplications.id, id));
  if (!a) notFound();
  const [settings, others] = await Promise.all([
    getSettings(),
    db.select({ id: jobApplications.id, jobTitle: jobApplications.jobTitle, status: jobApplications.status }).from(jobApplications).where(and(eq(jobApplications.email, a.email), ne(jobApplications.id, id))),
  ]);
  const country = countryByCode(a.country);
  return (
    <>
      <PageHeader
        back={{ href: a.jobId ? `/admin/careers/applications?job=${a.jobId}` : "/admin/careers/applications", label: "Applications" }}
        title={a.name}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={JOB_APPLICATION_TONE[a.status]}>{JOB_APPLICATION_LABEL[a.status]}</Badge> Applied for <strong className="text-ink">{a.jobTitle}</strong> · {formatDateTime(a.createdAt, settings.timezone, { zone: false })}</span>}
        actions={<>
          <a href={`mailto:${a.email}?subject=${encodeURIComponent(`Your application: ${a.jobTitle}`)}`} className={buttonClass.secondary}><MailIcon className="size-4" /> Email</a>
          {a.cvUrl && <a href={a.cvUrl} target="_blank" rel="noopener noreferrer" className={buttonClass.primary}><DownloadIcon className="size-4" /> Open CV</a>}
        </>}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card title="Applicant">
            <dl className="flex flex-col gap-3.5">
              <Row label="Email"><a href={`mailto:${a.email}`} className="text-accent-ink hover:underline">{a.email}</a></Row>
              <Row label="Phone"><a href={`tel:${a.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-accent-ink"><PhoneIcon className="size-4 text-muted" /> {a.phone}</a></Row>
              <Row label="Location">{[a.city, country ? `${flag(country.code)} ${country.name}` : a.country].filter(Boolean).join(", ")}</Row>
              <Row label="LinkedIn">{a.linkedinUrl && <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent-ink">Profile <ExternalIcon className="size-3.5" /></a>}</Row>
              <Row label="Portfolio">{a.portfolioUrl && <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-semibold text-accent-ink">{a.portfolioUrl.replace(/^https?:\/\//, "")} <ExternalIcon className="size-3.5 shrink-0" /></a>}</Row>
              <Row label="Can start">{a.noticePeriod}</Row>
              <Row label="Pay expectation">{a.salaryExpectation}</Row>
              <Row label="Heard about us">{a.heardFrom}</Row>
            </dl>
          </Card>
          <Card title="Why they're a good fit">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-body">{a.coverLetter}</p>
          </Card>
          {others.length > 0 && (
            <Card title="Other applications from them">
              <ul className="flex flex-col gap-2">{others.map((o) => <li key={o.id} className="flex items-center justify-between gap-3"><Link href={`/admin/careers/applications/${o.id}`} className="font-semibold text-ink hover:text-accent-ink">{o.jobTitle}</Link><Badge tone={JOB_APPLICATION_TONE[o.status]}>{JOB_APPLICATION_LABEL[o.status]}</Badge></li>)}</ul>
            </Card>
          )}
        </div>
        <Card title="Hiring stage" className="xl:sticky xl:top-24">
          <ActionForm action={updateJobApplication.bind(null, id)}>
            <Select label="Stage" name="status" defaultValue={a.status} options={JOB_APPLICATION_STATUSES.map((s) => ({ value: s, label: JOB_APPLICATION_LABEL[s] }))} />
            <Checkbox label="If moving to “Not progressing”, email them a polite note" name="notify" defaultChecked hint="Uses the “Job application unsuccessful” email template." />
            <Textarea label="Team notes" name="adminNotes" defaultValue={a.adminNotes} rows={6} hint="Only the team sees these." />
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
