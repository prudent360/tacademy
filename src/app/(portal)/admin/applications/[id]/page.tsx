import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { acceptApplication, rejectApplication, saveApplicationNotes, shortlistApplication } from "@/app/actions/applications";
import { ActionButton, ActionForm, Select, SubmitButton, Textarea } from "@/components/forms";
import { ExternalIcon } from "@/components/icons";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courses, internshipApplications, users } from "@/db/schema";
import { MODE_LABELS, STATUS_LABELS, STATUS_TONE } from "@/lib/applications";
import { countryByCode, flag } from "@/lib/countries";
import { getSettings } from "@/lib/data";
import { formatDateOnly, formatDateTime } from "@/lib/time";
import { idParam } from "@/lib/validation";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Application" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr]">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-[15px] text-ink">{children || <span className="text-muted">—</span>}</dd>
    </div>
  );
}

const link = (url: string | null) => url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-semibold text-accent hover:text-accent-dark">{url.replace(/^https?:\/\//, "")} <ExternalIcon className="size-3.5 shrink-0" /></a>;

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("applications.review");
  const id = idParam((await params).id);
  if (!id) notFound();
  const db = await getDb();
  const [application] = await db.select().from(internshipApplications).where(eq(internshipApplications.id, id));
  if (!application) notFound();
  const [settings, intakes, decidedBy, preferred] = await Promise.all([
    getSettings(),
    db.select({ id: cohorts.id, name: cohorts.name, startDate: cohorts.startDate, course: courses.title }).from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(and(eq(courses.kind, "internship"), eq(cohorts.enrollmentOpen, true))),
    application.decidedById ? db.select({ name: users.name }).from(users).where(eq(users.id, application.decidedById)).then((r) => r[0]) : undefined,
    application.preferredCohortId ? db.select({ name: cohorts.name, course: courses.title }).from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(eq(cohorts.id, application.preferredCohortId)).then((r) => r[0]) : undefined,
  ]);
  const country = countryByCode(application.country);
  const decided = application.status === "accepted" || application.status === "rejected";

  return (
    <>
      <PageHeader
        back={{ href: "/admin/applications", label: "Internship applications" }}
        title={application.name}
        description={<span className="flex flex-wrap items-center gap-2">Applied {formatDateTime(application.createdAt, settings.timezone)} <Badge tone={STATUS_TONE[application.status]}>{STATUS_LABELS[application.status]}</Badge>{application.graduateVerified && <Badge tone="green">Verified graduate</Badge>}</span>}
      />
      {application.graduateClaimed && !application.graduateVerified && <Notice tone="amber">They said they&apos;ve completed a course with us, but no completed course was found for {application.email}. They may have used a different email.</Notice>}
      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="About them">
            <dl className="divide-y divide-line">
              <Row label="Email"><a href={`mailto:${application.email}`} className="font-semibold text-accent">{application.email}</a></Row>
              <Row label="Phone / WhatsApp"><a href={`https://wa.me/${application.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">{application.phone}</a></Row>
              <Row label="Location">{country ? `${flag(country.code)} ${application.city ? `${application.city}, ` : ""}${country.name}` : application.country}</Row>
              <Row label="Qualification">{application.qualification}</Row>
              <Row label="Currently">{application.currentStatus}</Row>
            </dl>
          </Card>
          <Card title="What they want to do">
            <dl className="divide-y divide-line">
              <Row label="Internship area">{application.skillArea}</Row>
              <Row label="Experience">{application.experience}</Row>
              <Row label="Preferred intake">{preferred ? `${preferred.course} · ${preferred.name}` : "Not sure yet"}</Row>
              <Row label="Work mode">{MODE_LABELS[application.mode]}</Row>
              <Row label="Hours a week">{application.hoursPerWeek}</Row>
              <Row label="Equipment">{[application.hasLaptop ? "Has a laptop" : "No laptop", application.hasInternet ? "reliable internet" : "no reliable internet"].join(", ")}</Row>
            </dl>
          </Card>
          <Card title="Why they want to join">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-body">{application.motivation}</p>
            {application.heardFrom && <p className="mt-4 text-sm text-muted">Heard about us via {application.heardFrom}.</p>}
          </Card>
          <Card title="Their work">
            <dl className="divide-y divide-line">
              <Row label="Portfolio">{link(application.portfolioUrl)}</Row>
              <Row label="LinkedIn">{link(application.linkedinUrl)}</Row>
              <Row label="CV">{application.cvUrl && <a href={application.cvUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">Open CV <ExternalIcon className="size-3.5" /></a>}</Row>
            </dl>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Decision">
            {decided ? (
              <p className="text-sm text-body">{application.status === "accepted" ? "Accepted" : "Declined"}{decidedBy ? ` by ${decidedBy.name}` : ""}{application.decidedAt ? ` on ${formatDateOnly(application.decidedAt.toISOString().slice(0, 10))}` : ""}. {application.status === "accepted" ? "They were emailed a link to enrol." : "They were sent the “not successful” email."}</p>
            ) : (
              <div className="flex flex-col gap-5">
                {application.status === "new" && <ActionButton action={shortlistApplication.bind(null, id)} pendingText="…">Shortlist</ActionButton>}
                {intakes.length ? (
                  <ActionForm action={acceptApplication.bind(null, id)} className="flex flex-col gap-3 rounded-[5px] border border-edge p-4">
                    <Select label="Accept onto intake" name="cohortId" defaultValue={String(application.preferredCohortId && intakes.some((i) => i.id === application.preferredCohortId) ? application.preferredCohortId : intakes[0].id)} options={intakes.map((i) => ({ value: String(i.id), label: `${i.course} · ${i.name}${i.startDate ? ` (${formatDateOnly(i.startDate)})` : ""}` }))} />
                    <p className="text-xs text-muted">They&apos;re emailed a link to enrol on this intake. Verified graduates join free if the intake is set to “free for academy graduates”; everyone else pays its fee.</p>
                    <div><SubmitButton pendingText="Accepting…">Accept and send enrolment link</SubmitButton></div>
                  </ActionForm>
                ) : <Notice tone="amber">There are no open internship intakes to accept them onto. Add one under Courses first.</Notice>}
                <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                  <p className="text-xs text-muted">Sends a polite “not successful” email.</p>
                  <ActionButton action={rejectApplication.bind(null, id)} variant="danger" pendingText="…">Decline</ActionButton>
                </div>
              </div>
            )}
          </Card>
          <Card title="Private notes">
            <ActionForm action={saveApplicationNotes.bind(null, id)}>
              <Textarea label="Notes" name="adminNotes" defaultValue={application.adminNotes} rows={5} hint="Only admins see these." />
              <div><SubmitButton>Save notes</SubmitButton></div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
