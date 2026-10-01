import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { acceptInstructorApplication, rejectInstructorApplication, saveInstructorApplicationNotes, shortlistInstructorApplication } from "@/app/actions/instructor-applications";
import { ActionButton, ActionForm, SubmitButton, Textarea } from "@/components/forms";
import { ExternalIcon } from "@/components/icons";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { instructorApplications, users } from "@/db/schema";
import { MODE_LABELS, STATUS_LABELS, STATUS_TONE } from "@/lib/applications";
import { countryByCode, flag } from "@/lib/countries";
import { getSettings } from "@/lib/data";
import { formatDateOnly, formatDateTime } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Instructor application" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr]">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-[15px] text-ink">{children || <span className="text-muted">—</span>}</dd>
    </div>
  );
}

const link = (url: string | null) => url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-semibold text-accent hover:text-accent-dark">{url.replace(/^https?:\/\//, "")} <ExternalIcon className="size-3.5 shrink-0" /></a>;

export default async function InstructorApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const id = idParam((await params).id);
  if (!id) notFound();
  const db = await getDb();
  const [application] = await db.select().from(instructorApplications).where(eq(instructorApplications.id, id));
  if (!application) notFound();
  const [settings, decidedBy, existing] = await Promise.all([
    getSettings(),
    application.decidedById ? db.select({ name: users.name }).from(users).where(eq(users.id, application.decidedById)).then((r) => r[0]) : undefined,
    db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, application.email)).then((r) => r[0]),
  ]);
  const country = countryByCode(application.country);
  const decided = application.status === "accepted" || application.status === "rejected";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/instructor-applications", label: "Instructor applications" }}
        title={application.name}
        description={<span className="flex flex-wrap items-center gap-2">Applied {formatDateTime(application.createdAt, settings.timezone)} <Badge tone={STATUS_TONE[application.status]}>{STATUS_LABELS[application.status]}</Badge>{existing && <Badge tone="cyan">Has an account ({existing.role})</Badge>}</span>}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="About them">
            <dl className="divide-y divide-line">
              <Row label="Email"><a href={`mailto:${application.email}`} className="font-semibold text-accent">{application.email}</a></Row>
              <Row label="Phone / WhatsApp"><a href={`https://wa.me/${application.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">{application.phone}</a></Row>
              <Row label="Location">{country ? `${flag(country.code)} ${application.city ? `${application.city}, ` : ""}${country.name}` : application.country}</Row>
              <Row label="Current role">{application.currentRole}</Row>
            </dl>
          </Card>
          <Card title="Expertise">
            <dl className="divide-y divide-line">
              <Row label="Would teach">{application.expertise}</Row>
              <Row label="Years in this area">{application.yearsExperience}</Row>
              <Row label="Teaching experience">{application.teachingExperience}</Row>
              <Row label="LinkedIn">{link(application.linkedinUrl)}</Row>
              <Row label="Portfolio">{link(application.portfolioUrl)}</Row>
              <Row label="CV">{application.cvUrl && <a href={application.cvUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">Open CV <ExternalIcon className="size-3.5" /></a>}</Row>
            </dl>
          </Card>
          <Card title="What they'd teach">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-body">{application.topics}</p>
            <dl className="mt-4 divide-y divide-line border-t border-line">
              <Row label="Format">{application.mode === "remote" ? "Live online" : MODE_LABELS[application.mode]}</Row>
              <Row label="Availability">{application.availability}</Row>
            </dl>
            {application.heardFrom && <p className="mt-4 text-sm text-muted">Heard about us via {application.heardFrom}.</p>}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Decision">
            {decided ? (
              <div className="flex flex-col gap-3 text-sm text-body">
                <p>{application.status === "accepted" ? "Accepted" : "Declined"}{decidedBy ? ` by ${decidedBy.name}` : ""}{application.decidedAt ? ` on ${formatDateOnly(application.decidedAt.toISOString().slice(0, 10))}` : ""}. {application.status === "accepted" ? "They were emailed a link to their instructor account." : "They were sent the “not successful” email."}</p>
                {application.status === "accepted" && application.userId && <Link href={`/admin/users/${application.userId}`} className="font-semibold text-accent">Open their account →</Link>}
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {application.status === "new" && <ActionButton action={shortlistInstructorApplication.bind(null, id)} pendingText="…">Shortlist</ActionButton>}
                <ActionForm action={acceptInstructorApplication.bind(null, id)} className="flex flex-col gap-3 rounded-[5px] border border-edge p-4">
                  <p className="text-sm text-body">{existing ? (existing.role === "student" ? "They already have a student account; accepting makes it an instructor account." : `They already have an ${existing.role} account, which stays as it is.`) : "Accepting creates an instructor account and emails them a link to set their password."}</p>
                  <p className="text-xs text-muted">Then add them to a cohort from the cohort&apos;s Settings tab.</p>
                  <div><SubmitButton pendingText="Accepting…">Accept as instructor</SubmitButton></div>
                </ActionForm>
                <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                  <p className="text-xs text-muted">Sends a polite “not successful” email.</p>
                  <ActionButton action={rejectInstructorApplication.bind(null, id)} variant="danger" pendingText="…">Decline</ActionButton>
                </div>
              </div>
            )}
          </Card>
          <Card title="Private notes">
            <ActionForm action={saveInstructorApplicationNotes.bind(null, id)}>
              <Textarea label="Notes" name="adminNotes" defaultValue={application.adminNotes} rows={5} hint="Only admins see these. Useful for call and demo-lesson notes." />
              <div><SubmitButton>Save notes</SubmitButton></div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
