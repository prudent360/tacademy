import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { createAssignment, createSessions, deleteAnnouncement, postAnnouncement } from "@/app/actions/teach";
import { ActionForm, Checkbox, DeleteButton, FileField, Input, SubmitButton, Textarea } from "@/components/forms";
import { Markdown } from "@/components/markdown";
import { SessionRow } from "@/components/portal/session-row";
import { SessionFields } from "@/components/teach/session-fields";
import { Badge, Card, DataTable, EmptyState, ModeBadge, PageHeader, Tabs } from "@/components/ui";
import { CalendarIcon, ClipboardIcon, MegaphoneIcon, UsersIcon } from "@/components/icons";
import { getDb } from "@/db";
import { announcements, assignments, attendance, classSessions, submissions } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";
import { getCohortStudents, getCohortWithCourse, getSettings } from "@/lib/data";
import { formatDateOnly, formatDateTime, relativeTime, toZonedInput } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Cohort" };

type Tab = "classes" | "assignments" | "students" | "announcements";

export default async function TeachCohortPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id: raw }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  await requireTeacher(id);
  const found = await getCohortWithCourse(id);
  if (!found) notFound();
  const { cohort, course } = found;
  const settings = await getSettings();
  const tz = settings.timezone;
  const tab: Tab = (["classes", "assignments", "students", "announcements"] as const).find((t) => t === rawTab) ?? "classes";
  const db = await getDb();

  const [sessions, work, students, news] = await Promise.all([
    db.select().from(classSessions).where(eq(classSessions.cohortId, id)).orderBy(asc(classSessions.startsAt)),
    db.select().from(assignments).where(eq(assignments.cohortId, id)).orderBy(asc(assignments.dueAt)),
    getCohortStudents(id),
    db.select().from(announcements).where(eq(announcements.cohortId, id)).orderBy(desc(announcements.createdAt)),
  ]);
  const now = new Date();
  const base = `/teach/cohorts/${id}`;

  // A sensible default for the next class: a week after the last one, same time.
  const last = sessions.at(-1);
  const nextStart = last ? new Date(new Date(last.startsAt).getTime() + 7 * 86_400_000) : null;

  return (
    <>
      <PageHeader
        back={{ href: "/teach", label: "My cohorts" }}
        title={course.title}
        description={<span className="flex flex-wrap items-center gap-2">{cohort.name}{cohort.startDate && ` · ${formatDateOnly(cohort.startDate)}${cohort.endDate ? ` – ${formatDateOnly(cohort.endDate)}` : ""}`} <ModeBadge mode={cohort.deliveryMode} /></span>}
      />
      <Tabs current={tab} items={[
        { key: "classes", label: "Classes", href: base, count: sessions.length },
        { key: "assignments", label: "Assignments", href: `${base}?tab=assignments`, count: work.length },
        { key: "students", label: "Students", href: `${base}?tab=students`, count: students.length },
        { key: "announcements", label: "Announcements", href: `${base}?tab=announcements`, count: news.length },
      ]} />

      {tab === "classes" && (
        <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card title="Timetable">
            {sessions.length ? (
              <ul className="-my-4 divide-y divide-line">
                {sessions.map((s) => (
                  <SessionRow key={s.id} session={s} timeZone={tz} now={now} showActions={false}>
                    <Link href={`/teach/sessions/${s.id}`} className="w-fit text-sm font-semibold text-accent hover:text-accent-dark">
                      {new Date(s.endsAt) < now ? "Take attendance / add recording →" : "Edit class →"}
                    </Link>
                  </SessionRow>
                ))}
              </ul>
            ) : (
              <EmptyState icon={CalendarIcon} title="No classes yet">Add the first class. You can repeat it weekly to build the whole timetable at once.</EmptyState>
            )}
          </Card>
          <Card title="Add class">
            <ActionForm action={createSessions.bind(null, id)} resetOnSuccess>
              <SessionFields
                repeat
                defaults={{
                  mode: cohort.deliveryMode === "physical" ? "physical" : "virtual",
                  venue: cohort.venue,
                  startsAt: nextStart ? toZonedInput(nextStart, tz) : undefined,
                  durationMinutes: last ? Math.round((+new Date(last.endsAt) - +new Date(last.startsAt)) / 60000) : 120,
                  meetingUrl: [...sessions].reverse().find((s) => s.meetingUrl)?.meetingUrl ?? "",
                }}
              />
              <SubmitButton pendingText="Adding…">Add to timetable</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}

      {tab === "assignments" && <AssignmentsTab cohortId={id} work={work} studentCount={students.length} timeZone={tz} />}

      {tab === "students" && <StudentsTab cohortId={id} students={students} sessionIds={sessions.filter((s) => new Date(s.endsAt) < now && !s.cancelled).map((s) => s.id)} assignmentIds={work.map((w) => w.id)} />}

      {tab === "announcements" && (
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.3fr]">
          <Card title="Post an announcement">
            <ActionForm action={postAnnouncement.bind(null, id)} resetOnSuccess>
              <Input label="Title" name="title" required />
              <Textarea label="Message" name="body" rows={6} hint="Markdown supported." />
              <Checkbox label="Also email every student" name="email" defaultChecked />
              <SubmitButton pendingText="Posting…">Post</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="Posted">
            {news.length ? (
              <ul className="-my-2 flex flex-col divide-y divide-line">
                {news.map((n) => (
                  <li key={n.id} className="flex flex-col gap-2 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{n.title}</p>
                        <p className="text-xs text-muted">{relativeTime(n.createdAt)}</p>
                      </div>
                      <DeleteButton action={deleteAnnouncement.bind(null, n.id)} />
                    </div>
                    {n.body && <div className="text-[15px]"><Markdown>{n.body}</Markdown></div>}
                  </li>
                ))}
              </ul>
            ) : <p className="flex items-center gap-2 text-muted"><MegaphoneIcon className="size-5" /> Nothing posted yet.</p>}
          </Card>
        </div>
      )}
    </>
  );
}

async function AssignmentsTab({ cohortId, work, studentCount, timeZone }: { cohortId: number; work: (typeof assignments.$inferSelect)[]; studentCount: number; timeZone: string }) {
  const ids = work.map((w) => w.id);
  const counts = ids.length
    ? await (await getDb()).select({ assignmentId: submissions.assignmentId, status: submissions.status, n: count() }).from(submissions).where(inArray(submissions.assignmentId, ids)).groupBy(submissions.assignmentId, submissions.status)
    : [];
  const tally = (id: number, status?: string) => counts.filter((c) => c.assignmentId === id && (!status || c.status === status)).reduce((a, c) => a + c.n, 0);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Card title="Assignments" padded={false}>
        {work.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {work.map((a) => (
              <li key={a.id}>
                <Link href={`/teach/assignments/${a.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-panel md:px-6">
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 font-semibold text-ink">{a.title} {!a.published && <Badge>Draft</Badge>}</span>
                    <span className="text-sm text-muted">{a.dueAt ? `Due ${formatDateTime(a.dueAt, timeZone)}` : "No deadline"}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-muted">{tally(a.id)}/{studentCount} submitted</span>
                    {tally(a.id, "submitted") > 0 && <Badge tone="cyan">{tally(a.id, "submitted")} to grade</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <div className="p-6"><EmptyState icon={ClipboardIcon} title="No assignments yet">Create one; students are emailed as soon as it&apos;s published.</EmptyState></div>}
      </Card>
      <Card title="New assignment">
        <ActionForm action={createAssignment.bind(null, cohortId)}>
          <Input label="Title" name="title" required />
          <Textarea label="Instructions" name="instructions" rows={7} hint="Markdown supported: headings, lists, links, code." />
          <FileField label="Brief or resources (optional)" name="attachment" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.csv,.txt,image/*" removeName="removeAttachment" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Due" name="dueAt" type="datetime-local" />
            <Input label="Max score" name="maxScore" type="number" min={1} max={1000} defaultValue={100} required />
          </div>
          <Checkbox label="Publish now and notify students" name="published" defaultChecked />
          <SubmitButton pendingText="Creating…">Create assignment</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

async function StudentsTab({ cohortId, students, sessionIds, assignmentIds }: { cohortId: number; students: Awaited<ReturnType<typeof getCohortStudents>>; sessionIds: number[]; assignmentIds: number[] }) {
  const db = await getDb();
  const ids = students.map((s) => s.id);
  const [marks, grades] = await Promise.all([
    sessionIds.length && ids.length ? db.select().from(attendance).where(and(inArray(attendance.sessionId, sessionIds), inArray(attendance.userId, ids))) : [],
    assignmentIds.length && ids.length ? db.select({ userId: submissions.userId, status: submissions.status, score: submissions.score, max: assignments.maxScore }).from(submissions).innerJoin(assignments, eq(assignments.id, submissions.assignmentId)).where(and(inArray(submissions.assignmentId, assignmentIds), inArray(submissions.userId, ids))) : [],
  ]);
  if (!students.length) return <EmptyState icon={UsersIcon} title="No students yet">Students appear here once they enrol and pay, or when an admin adds them.</EmptyState>;
  return (
    <div className="flex flex-col gap-4">
      <DataTable>
        <thead><tr><th>Student</th><th>Attendance</th><th>Submitted</th><th>Average</th><th>Status</th></tr></thead>
        <tbody>
          {students.map((s) => {
            const mine = marks.filter((m) => m.userId === s.id);
            const attended = mine.filter((m) => m.status === "present" || m.status === "late").length;
            const work = grades.filter((g) => g.userId === s.id);
            const scored = work.filter((g) => g.status === "graded" && g.score !== null);
            const avg = scored.length ? Math.round(scored.reduce((a, g) => a + (g.score! / g.max) * 100, 0) / scored.length) : null;
            return (
              <tr key={s.id}>
                <td><span className="flex flex-col"><span className="font-semibold text-ink">{s.name}</span><a href={`mailto:${s.email}`} className="text-sm text-accent">{s.email}</a></span></td>
                <td>{mine.length ? `${attended}/${mine.length} (${Math.round((attended / mine.length) * 100)}%)` : "–"}</td>
                <td>{work.length}/{assignmentIds.length}</td>
                <td className="font-semibold">{avg === null ? "–" : `${avg}%`}</td>
                <td><Badge tone={s.status === "completed" ? "accent" : "green"}>{s.status === "completed" ? "Completed" : "Active"}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
      <details className="rounded-[14px] border border-edge bg-white px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-accent">Copy email addresses</summary>
        <textarea readOnly className="mt-3 w-full rounded-lg border border-edge bg-panel p-3 font-mono text-sm" rows={3} defaultValue={students.map((s) => s.email).join(", ")} aria-label={`Email addresses for cohort ${cohortId}`} />
      </details>
    </div>
  );
}
