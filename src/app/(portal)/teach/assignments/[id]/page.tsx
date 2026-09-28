import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteAssignment, updateAssignment } from "@/app/actions/teach";
import { ActionForm, Checkbox, DeleteButton, FileField, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Badge, Card, DataTable, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { assignments, courseModules, lessons, submissions, users } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";
import { getCohortStudents, getCohortWithCourse, getSettings } from "@/lib/data";
import { formatDateTime, toZonedInput } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Assignment" };

export default async function TeachAssignmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id: raw }, { created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const [assignment] = await db.select().from(assignments).where(eq(assignments.id, id));
  if (!assignment) notFound();
  await requireTeacher(assignment.cohortId);
  const [settings, found, students, subs] = await Promise.all([
    getSettings(),
    getCohortWithCourse(assignment.cohortId),
    getCohortStudents(assignment.cohortId),
    db.select({ submission: submissions, name: users.name }).from(submissions).innerJoin(users, eq(users.id, submissions.userId)).where(eq(submissions.assignmentId, id)).orderBy(asc(submissions.submittedAt)),
  ]);
  const tz = settings.timezone;
  const missing = students.filter((s) => !subs.some((x) => x.submission.userId === s.id));
  const courseLessons = found ? await db.select({ lesson: lessons, module: courseModules }).from(courseModules).innerJoin(lessons, eq(lessons.moduleId, courseModules.id)).where(eq(courseModules.courseId, found.course.id)).orderBy(asc(courseModules.position), asc(lessons.position)) : [];

  return (
    <>
      <PageHeader back={{ href: `/teach/cohorts/${assignment.cohortId}?tab=assignments`, label: found?.course.title ?? "Cohort" }} title={assignment.title} description={assignment.dueAt ? `Due ${formatDateTime(assignment.dueAt, tz)}` : "No deadline"} />
      {created && <Notice>Assignment created{assignment.published ? " and students have been notified" : " as a draft"}.</Notice>}
      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title={`Submissions (${subs.length}/${students.length})`} padded={false}>
            {subs.length ? (
              <DataTable>
                <thead><tr><th>Student</th><th>Submitted</th><th>Status</th><th>Score</th><th /></tr></thead>
                <tbody>
                  {subs.map(({ submission, name }) => {
                    const late = assignment.dueAt && new Date(submission.submittedAt) > new Date(assignment.dueAt);
                    return (
                      <tr key={submission.id}>
                        <td className="font-semibold text-ink">{name}</td>
                        <td className="whitespace-nowrap text-muted">{formatDateTime(submission.submittedAt, tz, { zone: false })} {late && <Badge tone="amber">Late</Badge>}</td>
                        <td><StatusBadge status={submission.status} label={submission.status === "submitted" ? "To grade" : submission.status === "resubmit" ? "Changes requested" : "Graded"} /></td>
                        <td className="font-semibold">{submission.score !== null ? `${submission.score}/${assignment.maxScore}` : "–"}</td>
                        <td className="text-right"><Link href={`/teach/submissions/${submission.id}`} className="text-sm font-semibold text-accent">{submission.status === "submitted" ? "Grade" : "View"}</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            ) : <p className="p-6 text-muted">No submissions yet.</p>}
          </Card>
          {missing.length > 0 && (
            <Card title={`Not submitted (${missing.length})`}>
              <p className="text-[15px] text-body">{missing.map((m) => m.name).join(", ")}</p>
              <p className="mt-2 text-sm text-muted">They&apos;ll get an automatic reminder about a day before the deadline.</p>
            </Card>
          )}
        </div>
        <Card title="Edit assignment">
          <ActionForm action={updateAssignment.bind(null, id)}>
            <Input label="Title" name="title" defaultValue={assignment.title} required />
            <Textarea label="Instructions" name="instructions" rows={8} defaultValue={assignment.instructions} hint="Markdown supported." />
            <Select label="Place after lesson" name="lessonId" defaultValue={assignment.lessonId ?? ""} hint="Optional. Linked assignments appear in the cohort's learning sequence." options={[{ value: "", label: "Not linked to a lesson" }, ...courseLessons.map((row) => ({ value: String(row.lesson.id), label: `${row.module.title} — ${row.lesson.title}` }))]} />
            <FileField label="Brief or resources" name="attachment" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.csv,.txt,image/*" current={assignment.attachmentUrl} removeName="removeAttachment" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Due" name="dueAt" type="datetime-local" defaultValue={toZonedInput(assignment.dueAt, tz)} />
              <Input label="Max score" name="maxScore" type="number" min={1} max={1000} defaultValue={assignment.maxScore} required />
            </div>
            <Checkbox label="Published (visible to students)" name="published" defaultChecked={assignment.published} hint={assignment.published ? undefined : "Publishing notifies every student by email."} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SubmitButton>Save</SubmitButton>
              <DeleteButton action={deleteAssignment.bind(null, id)} label="Delete assignment" />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
