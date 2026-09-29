import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { addStudentToCohort, deleteCohort, issueCertificate, setEnrollmentStatus, updateCohort } from "@/app/actions/admin";
import { CohortForm } from "@/components/admin/cohort-form";
import { ActionButton, ActionForm, DeleteButton, Input, SubmitButton } from "@/components/forms";
import { Card, Notice, PageHeader, StatusBadge, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { certificates, cohortInstructors, enrollments, users } from "@/db/schema";
import { getCohortWithCourse, getSettings } from "@/lib/data";
import { certificateEligibility } from "@/lib/certificates";
import { relativeTime } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Cohort" };

export default async function AdminCohortPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id: raw }, { created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const found = await getCohortWithCourse(id);
  if (!found) notFound();
  const { cohort, course } = found;
  const db = await getDb();
  const [settings, staff, assigned, roster] = await Promise.all([
    getSettings(),
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(inArray(users.role, ["instructor", "admin"])),
    db.select({ userId: cohortInstructors.userId }).from(cohortInstructors).where(eq(cohortInstructors.cohortId, id)),
    db.select({ enrollment: enrollments, user: { id: users.id, name: users.name, email: users.email } }).from(enrollments).innerJoin(users, eq(users.id, enrollments.userId)).where(eq(enrollments.cohortId, id)).orderBy(desc(enrollments.createdAt)),
  ]);
  const enrollmentIds = roster.map((row) => row.enrollment.id);
  const issued = enrollmentIds.length ? await db.select().from(certificates).where(inArray(certificates.enrollmentId, enrollmentIds)) : [];
  const certificateFor = new Map(issued.map((certificate) => [certificate.enrollmentId, certificate]));
  const eligibilityRows = await Promise.all(roster.map(async ({ enrollment }) => [enrollment.id, await certificateEligibility(enrollment.id)] as const));
  const eligibilityFor = new Map(eligibilityRows);
  const activeCount = roster.filter((r) => ["active", "completed"].includes(r.enrollment.status)).length;

  return (
    <>
      <PageHeader
        back={{ href: `/admin/${course.kind === "internship" ? "internships" : "courses"}/${course.id}`, label: course.title }}
        title={`${course.title}: ${cohort.name}`}
        actions={<Link href={`/teach/cohorts/${id}`} className={buttonClass.primary}>Classes & assignments</Link>}
      />
      {created && <Notice>{course.kind === "internship" ? "Intake" : "Cohort"} created. Add its classes from &ldquo;Classes & assignments&rdquo;{course.published ? "." : ", and publish the course so students can enrol."}</Notice>}
      <div className="grid items-start gap-6 2xl:grid-cols-[1.2fr_1fr]">
        <Card title={course.kind === "internship" ? "Intake settings" : "Cohort settings"}>
          <CohortForm action={updateCohort.bind(null, id, course.id)} cohort={cohort} instructors={staff} assigned={assigned.map((a) => a.userId)} currencies={settings.currencies} internship={course.kind === "internship"} />
        </Card>
        <div className="flex flex-col gap-6">
          <Card title={`Students (${activeCount}${cohort.capacity ? ` of ${cohort.capacity}` : ""})`}>
            <ActionForm action={addStudentToCohort.bind(null, id)} resetOnSuccess className="mb-5 flex flex-col gap-4 border-b border-line pb-5">
              <p className="text-sm text-muted">Enrol someone without online payment (e.g. scholarship or bank transfer). New emails get an account and an invitation to set a password.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Email" name="email" type="email" required />
                <Input label="Name (for new accounts)" name="name" />
              </div>
              <SubmitButton pendingText="Adding…">Add student</SubmitButton>
            </ActionForm>
            {roster.length ? (
              <ul className="-my-2 flex flex-col divide-y divide-line">
                {roster.map(({ enrollment, user }) => {
                  const eligibility = eligibilityFor.get(enrollment.id);
                  return (
                  <li key={enrollment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="flex min-w-0 flex-col">
                      <Link href={`/admin/users/${user.id}`} className="font-semibold text-ink hover:text-accent">{user.name}</Link>
                      <span className="truncate text-sm text-muted">{user.email} · {enrollment.source} · {relativeTime(enrollment.createdAt)}</span>
                      {eligibility && !eligibility.eligible && enrollment.status !== "cancelled" && <span className="mt-1 max-w-xl text-xs text-amber-800">Certificate pending: {eligibility.reasons.join(" ")}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={enrollment.status} />
                      {enrollment.status === "active" && <ActionButton action={setEnrollmentStatus.bind(null, enrollment.id, "completed")} variant="primary" pendingText="Completing…">{eligibility?.eligible ? "Complete & issue" : "Mark completed"}</ActionButton>}
                      {enrollment.status === "completed" && certificateFor.get(enrollment.id) && <Link href={`/certificates/${certificateFor.get(enrollment.id)!.code}`} className="text-sm font-semibold text-accent" target="_blank">Certificate</Link>}
                      {enrollment.status === "completed" && !certificateFor.get(enrollment.id) && eligibility?.eligible && <ActionButton action={issueCertificate.bind(null, enrollment.id)} variant="primary" pendingText="Issuing…">Issue certificate</ActionButton>}
                      {enrollment.status === "active" && <ActionButton action={setEnrollmentStatus.bind(null, enrollment.id, "cancelled")} variant="danger" pendingText="…">Remove</ActionButton>}
                      {enrollment.status === "cancelled" && <ActionButton action={setEnrollmentStatus.bind(null, enrollment.id, "active")} pendingText="…">Restore</ActionButton>}
                    </span>
                  </li>
                );})}
              </ul>
            ) : <p className="text-muted">No students yet.</p>}
          </Card>
          {roster.some((r) => r.enrollment.status === "active") && (
            <Card title="End of course">
              <p className="mb-4 text-sm text-muted">Mark every active student as completed when the cohort finishes. Completed students keep access to their materials and feedback but stop receiving reminders.</p>
              <CompleteButton ids={roster.filter((r) => r.enrollment.status === "active").map((r) => r.enrollment.id)} />
            </Card>
          )}
          <div className="flex justify-end"><DeleteButton action={deleteCohort.bind(null, id)} label="Delete cohort" /></div>
        </div>
      </div>
    </>
  );
}

async function completeAll(ids: number[]) {
  "use server";
  for (const id of ids) await setEnrollmentStatus(id, "completed");
}

function CompleteButton({ ids }: { ids: number[] }) {
  return <ActionButton action={completeAll.bind(null, ids)} pendingText="Updating…">Mark {ids.length} {ids.length === 1 ? "student" : "students"} as completed</ActionButton>;
}
