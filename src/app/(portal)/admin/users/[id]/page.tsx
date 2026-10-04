import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { resendInvite, updateUser } from "@/app/actions/admin";
import { ActionButton, ActionForm, Checkbox, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Card, DataTable, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { cohortInstructors, cohorts, courses, enrollments, payments, users } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { formatDateOnly, relativeTime } from "@/lib/time";
import { idParam } from "@/lib/validation";
import { GENDER_OPTIONS, studentId } from "@/lib/utils";
import { COUNTRIES, countryByCode, flag } from "@/lib/countries";
import { can, requirePermission } from "@/lib/auth";
import { DeletePersonButton } from "@/components/admin/delete-person";

export const metadata: Metadata = { title: "Person" };

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ invited?: string }> }) {
  const viewer = await requirePermission("users.view");
  const [{ id: raw }, { invited }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) notFound();
  const canManage = (await can(viewer, "users.manage")) && viewer.id !== id;
  const [enrolled, teaching, paid] = await Promise.all([
    db.select({ enrollment: enrollments, cohort: cohorts, course: courses }).from(enrollments).innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(eq(enrollments.userId, id)).orderBy(desc(enrollments.createdAt)),
    db.select({ cohort: cohorts, course: courses }).from(cohortInstructors).innerJoin(cohorts, eq(cohorts.id, cohortInstructors.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(eq(cohortInstructors.userId, id)),
    db.select().from(payments).where(eq(payments.userId, id)).orderBy(desc(payments.createdAt)),
  ]);

  return (
    <>
      <PageHeader back={{ href: "/admin/users", label: "People" }} title={user.name} description={`${user.role === "student" ? `${studentId(user)} · ` : ""}${user.email}${countryByCode(user.country) ? ` · ${flag(user.country!)} ${countryByCode(user.country)!.name}` : ""} · joined ${relativeTime(user.createdAt)}`} actions={<ActionButton action={resendInvite.bind(null, id)} pendingText="Sending…" doneText="Email sent">{user.passwordHash ? "Send password reset" : "Resend invitation"}</ActionButton>} />
      {invited && <Notice>Invitation sent to {user.email}.</Notice>}
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Card title="Account">
          <ActionForm action={updateUser.bind(null, id)}>
            <Input label="Full name" name="name" defaultValue={user.name} required />
            <Input label="Email" name="email" type="email" defaultValue={user.email} required hint="If you change it, they sign in with the new address and confirm it." />
            <Select label="Role" name="role" defaultValue={user.role} options={[{ value: "student", label: "Student" }, { value: "instructor", label: "Instructor" }, { value: "admin", label: "Admin" }, ...(user.role === "staff" ? [{ value: "staff", label: "Team member (role set in Team & roles)" }] : [])]} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Phone" name="phone" defaultValue={user.phone} />
              <Select label="Gender" name="gender" defaultValue={user.gender ?? ""} options={GENDER_OPTIONS.map((g) => ({ value: g.value, label: g.label }))} hint="Picks the default avatar." />
            </div>
            <Select label="Country" name="country" defaultValue={user.country ?? ""} options={[{ value: "", label: "Not given" }, ...COUNTRIES.map((c) => ({ value: c.code, label: `${flag(c.code)} ${c.name}` }))]} />
            {(user.dateOfBirth || user.qualification) && <dl className="grid gap-3 rounded-[5px] bg-panel p-4 text-sm sm:grid-cols-2"><div><dt className="text-muted">Date of birth</dt><dd className="font-semibold text-ink">{user.dateOfBirth ? formatDateOnly(user.dateOfBirth) : "—"}</dd></div><div><dt className="text-muted">Highest qualification</dt><dd className="font-semibold text-ink">{user.qualification || "—"}</dd></div></dl>}
            <Textarea label="Bio" name="bio" defaultValue={user.bio} hint="Shown on course pages for instructors." />
            <Checkbox label="Account active" name="active" defaultChecked={user.active} hint="Deactivated accounts can't sign in." />
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
          {canManage && (
            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
              <div>
                <p className="text-sm font-semibold text-ink">Delete this account</p>
                <p className="text-[13px] text-muted">{paid.some((p) => p.paidAt) ? "They have payments on record, so they can't be deleted. Untick “Account active” to deactivate them instead." : "Permanently removes their account, enrolments and work. This can't be undone."}</p>
              </div>
              {!paid.some((p) => p.paidAt) && <DeletePersonButton id={id} name={user.name} />}
            </div>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          {teaching.length > 0 && (
            <Card title="Teaches">
              <ul className="flex flex-col gap-2">{teaching.map(({ cohort, course }) => <li key={cohort.id}><Link href={`/teach/cohorts/${cohort.id}`} className="font-semibold text-accent-ink">{course.title}: {cohort.name}</Link></li>)}</ul>
            </Card>
          )}
          <Card title="Enrolments" padded={false}>
            {enrolled.length ? (
              <DataTable>
                <thead><tr><th>Course</th><th>Starts</th><th>Status</th></tr></thead>
                <tbody>{enrolled.map(({ enrollment, cohort, course }) => (
                  <tr key={enrollment.id}><td><Link href={`/teach/cohorts/${cohort.id}`} className="font-semibold text-ink hover:text-accent-ink">{course.title}</Link><p className="text-sm text-muted">{cohort.name}</p></td><td className="text-muted">{formatDateOnly(cohort.startDate) || "TBC"}</td><td><StatusBadge status={enrollment.status} /></td></tr>
                ))}</tbody>
              </DataTable>
            ) : <p className="p-6 text-muted">No enrolments.</p>}
          </Card>
          <Card title="Payments" padded={false}>
            {paid.length ? (
              <DataTable>
                <thead><tr><th>For</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>{paid.map((p) => <tr key={p.id}><td>{p.description}<p className="font-mono text-xs text-muted">{p.reference}</p></td><td className="font-semibold">{formatMoney(p.amount, p.currency)}</td><td><StatusBadge status={p.status} /></td></tr>)}</tbody>
              </DataTable>
            ) : <p className="p-6 text-muted">No payments.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
