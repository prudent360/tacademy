import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { AwardIcon, CheckCircleIcon, ExternalIcon } from "@/components/icons";
import { ProgressBar } from "@/components/portal/dash";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { certificates, cohorts, courses, enrollments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { certificateEligibility } from "@/lib/certificates";
import { formatDateOnly } from "@/lib/time";
import { LinkedInButtons } from "@/components/linkedin-buttons";
import { getSettings } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = { title: "Certificates" };

export default async function StudentCertificatesPage() {
  const user = await requireUser();
  const db = await getDb();
  const { siteName } = await getSettings();
  const rows = await db
    .select({ certificate: certificates, course: courses, cohort: cohorts })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(enrollments.userId, user.id), isNull(certificates.revokedAt)))
    .orderBy(desc(certificates.issuedAt));
  const issuedIds = new Set(rows.map((row) => row.certificate.enrollmentId));
  const active = await db.select({ enrollment: enrollments, course: courses, cohort: cohorts }).from(enrollments).innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(eq(enrollments.userId, user.id));
  const pending = (await Promise.all(active.filter((row) => !issuedIds.has(row.enrollment.id) && row.enrollment.status !== "cancelled" && row.course.certificateEnabled).map(async (row) => ({ ...row, eligibility: await certificateEligibility(row.enrollment.id) })))).filter((row) => row.eligibility);
  return (
    <>
      <PageHeader title="Certificates" description="Track your certificate requirements and access verified credentials after course completion." />
      {rows.length ? (
        <div className="grid gap-5 md:grid-cols-2">
          {rows.map(({ certificate, course, cohort }) => (
            <Card key={certificate.id} className="relative overflow-hidden">
              <span className="flex size-11 items-center justify-center rounded-[5px] bg-accent-soft text-accent-ink"><AwardIcon className="size-6" /></span>
              <p className="mt-5 font-display text-xl font-bold text-ink">{course.title}</p>
              <p className="mt-1 text-sm text-muted">{cohort.name} · issued {formatDateOnly(certificate.issuedAt.toISOString().slice(0, 10))}</p>
              <p className="mt-4 font-mono text-xs text-muted">{certificate.code}</p>
              <Link href={`/certificates/${certificate.code}`} target="_blank" className={`${buttonClass.primary} mt-5`}><ExternalIcon className="size-4" /> View certificate</Link>
              <LinkedInButtons className="mt-3" course={course.title} organisation={siteName} issuedAt={certificate.issuedAt} url={absoluteUrl(`/certificates/${certificate.code}`)} code={certificate.code} />
            </Card>
          ))}
        </div>
      ) : pending.length === 0 && <EmptyState icon={AwardIcon} title="No certificates yet">Enrol on a certificate-enabled course and your progress will appear here.</EmptyState>}
      {pending.length > 0 && <section className="mt-7 flex flex-col gap-4"><div><h2 className="font-display text-xl font-bold text-ink">Certificate progress</h2><p className="mt-1 text-sm text-muted">Meet every requirement below. Your certificate is issued when the academy marks the course complete.</p></div><div className="grid gap-5 md:grid-cols-2">{pending.map(({ enrollment, course, cohort, eligibility }) => <Card key={enrollment.id}>
        <div className="flex items-start justify-between gap-3"><div><p className="font-display text-lg font-bold text-ink">{course.title}</p><p className="text-sm text-muted">{cohort.name}</p></div>{eligibility!.eligible ? <Badge tone="green"><CheckCircleIcon className="size-3.5" /> Ready</Badge> : <Badge tone="amber">In progress</Badge>}</div>
        <div className="mt-5 flex flex-col gap-4"><ProgressBar value={eligibility!.attendance} max={100} label="Attendance" detail={`${eligibility!.attendance}% · ${eligibility!.requirements.attendance}% required`} /><ProgressBar value={eligibility!.assignments} max={100} label="Assignments" detail={`${eligibility!.assignments}% · ${eligibility!.requirements.assignments}% required`} /><ProgressBar value={eligibility!.averageScore} max={100} label="Average score" detail={`${eligibility!.averageScore}% · ${eligibility!.requirements.averageScore}% required`} />{eligibility!.quizScore !== null && eligibility!.requirements.quizScore > 0 && <ProgressBar value={eligibility!.quizScore} max={100} label="Average quiz score" detail={`${eligibility!.quizScore}% · ${eligibility!.requirements.quizScore}% required`} />}</div>
        {eligibility!.eligible ? <p className="mt-5 rounded-[5px] bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">All requirements met. Your certificate is ready once the course is marked complete.</p> : <ul className="mt-5 space-y-1 text-xs text-amber-800">{eligibility!.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>}
      </Card>)}</div></section>}
    </>
  );
}
