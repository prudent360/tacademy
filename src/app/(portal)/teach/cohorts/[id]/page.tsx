import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { addStudentToCohort, deleteCohort, issueCertificate, setEnrollmentStatus, updateCohort } from "@/app/actions/admin";
import { createAssignment, createSessions, deleteAnnouncement, postAnnouncement } from "@/app/actions/teach";
import { setModuleRelease } from "@/app/actions/learning";
import { CohortForm } from "@/components/admin/cohort-form";
import { ActionButton, ActionForm, Checkbox, DeleteButton, FileField, Input, Select, SubmitButton } from "@/components/forms";
import { Markdown } from "@/components/markdown";
import { SessionRow } from "@/components/portal/session-row";
import { AttendanceForm } from "@/components/teach/attendance-form";
import { SessionFields } from "@/components/teach/session-fields";
import { Badge, Card, DataTable, EmptyState, ModeBadge, Notice, PageHeader, StatusBadge, Tabs, buttonClass } from "@/components/ui";
import { BookIcon, CalendarIcon, ClipboardIcon, EditIcon, MegaphoneIcon, UsersIcon, VideoIcon } from "@/components/icons";
import { getDb } from "@/db";
import { announcements, assignments, attendance, certificates, classSessions, cohortInstructors, courseModules, enrollments, lessonProgress, lessons, moduleReleases, submissions, users, type ClassSession, type Cohort, type Course } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";
import { certificateEligibility } from "@/lib/certificates";
import { getCohortStudents, getCohortWithCourse, getSettings } from "@/lib/data";
import { formatDateOnly, formatDateTime, formatSessionRange, relativeTime, toZonedInput, untilLabel } from "@/lib/time";
import { idParam } from "@/lib/validation";
import { draftAnnouncement } from "@/app/actions/ai";
import { AiDraftButton } from "@/components/ai/draft-button";
import { aiAvailable } from "@/lib/ai";
import { cohortQuizReport } from "@/lib/quiz";
import { RichTextEditor } from "@/components/rich-text-editor";

export const metadata: Metadata = { title: "Cohort" };

const TABS = ["overview", "classes", "lessons", "assignments", "students", "announcements", "settings"] as const;
type Tab = (typeof TABS)[number];
type Mark = { sessionId: number; userId: number; status: typeof attendance.$inferSelect.status };

/** One place to run a cohort, for admins and instructors alike. Settings is admin only. */
export default async function CohortPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; created?: string }> }) {
  const [{ id: raw }, { tab: rawTab, created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const user = await requireTeacher(id);
  const isAdmin = user.role === "admin";
  const aiWriting = await aiAvailable("writing");
  const found = await getCohortWithCourse(id);
  if (!found) notFound();
  const { cohort, course } = found;
  const settings = await getSettings();
  const tz = settings.timezone;
  // "learning" was the old name for the lessons tab; old links still work.
  const wanted = rawTab === "learning" ? "lessons" : rawTab;
  const tab: Tab = TABS.find((t) => t === wanted && (t !== "settings" || isAdmin)) ?? "overview";
  const db = await getDb();

  const [sessions, work, students, news, learning, toGrade] = await Promise.all([
    db.select().from(classSessions).where(eq(classSessions.cohortId, id)).orderBy(asc(classSessions.startsAt)),
    db.select().from(assignments).where(eq(assignments.cohortId, id)).orderBy(asc(assignments.dueAt)),
    getCohortStudents(id),
    db.select().from(announcements).where(eq(announcements.cohortId, id)).orderBy(desc(announcements.createdAt)),
    db.select({ module: courseModules, lesson: lessons, releaseAt: moduleReleases.releaseAt }).from(courseModules).leftJoin(lessons, eq(lessons.moduleId, courseModules.id)).leftJoin(moduleReleases, and(eq(moduleReleases.moduleId, courseModules.id), eq(moduleReleases.cohortId, id))).where(eq(courseModules.courseId, course.id)).orderBy(asc(courseModules.position), asc(lessons.position)),
    db.select({ n: count() }).from(submissions).innerJoin(assignments, eq(assignments.id, submissions.assignmentId)).where(and(eq(assignments.cohortId, id), eq(submissions.status, "submitted"))).then((r) => r[0]?.n ?? 0),
  ]);
  const marks: Mark[] = sessions.length ? await db.select({ sessionId: attendance.sessionId, userId: attendance.userId, status: attendance.status }).from(attendance).where(inArray(attendance.sessionId, sessions.map((s) => s.id))) : [];
  const now = new Date();
  const base = `/teach/cohorts/${id}`;
  const held = sessions.filter((s) => new Date(s.endsAt) < now && !s.cancelled);
  const needsAttendance = students.some((s) => s.status === "active") ? held.filter((s) => !marks.some((m) => m.sessionId === s.id)) : [];
  const publishedLessons = learning.filter((row) => row.lesson?.published).length;
  const internship = course.kind === "internship";

  return (
    <>
      <PageHeader
        back={isAdmin ? { href: `/admin/${internship ? "internships" : "courses"}/${course.id}`, label: course.title } : { href: "/teach", label: "Teaching" }}
        title={`${course.title}: ${cohort.name}`}
        description={<span className="flex flex-wrap items-center gap-2">{cohort.startDate ? `${formatDateOnly(cohort.startDate)}${cohort.endDate ? ` – ${formatDateOnly(cohort.endDate)}` : ""}` : "Dates to be confirmed"} <ModeBadge mode={cohort.deliveryMode} /></span>}
      />
      {created && <Notice>{internship ? "Intake" : "Cohort"} created. Next, add its live classes under Live classes{course.published ? "." : ", and publish the course so students can enrol."}</Notice>}
      <Tabs current={tab} items={[
        { key: "overview", label: "Overview", href: base },
        { key: "classes", label: "Live classes", href: `${base}?tab=classes`, count: sessions.length },
        { key: "lessons", label: "Lessons", href: `${base}?tab=lessons`, count: publishedLessons },
        { key: "assignments", label: "Assignments", href: `${base}?tab=assignments`, count: work.length },
        { key: "students", label: "Students", href: `${base}?tab=students`, count: students.length },
        { key: "announcements", label: "Announcements", href: `${base}?tab=announcements`, count: news.length },
        ...(isAdmin ? [{ key: "settings", label: "Settings", href: `${base}?tab=settings` }] : []),
      ]} />

      {tab === "overview" && <OverviewTab base={base} cohort={cohort} sessions={sessions} needsAttendance={needsAttendance} toGrade={toGrade} studentCount={students.length} publishedLessons={publishedLessons} assignmentCount={work.length} timeZone={tz} now={now} />}

      {tab === "classes" && (
        <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
          <ClassesTimetable sessions={sessions} students={students} marks={marks} timeZone={tz} now={now} />
          <AddClassCard cohortId={id} cohort={cohort} sessions={sessions} timeZone={tz} />
        </div>
      )}

      {tab === "lessons" && <LearningTab cohortId={id} courseId={course.id} learning={learning} students={students} editHref={isAdmin ? `/admin/${internship ? "internships" : "courses"}/${course.id}#curriculum` : `/teach/courses/${course.id}/curriculum?cohort=${id}`} />}

      {tab === "assignments" && <AssignmentsTab cohortId={id} work={work} studentCount={students.length} timeZone={tz} learning={learning} />}

      {tab === "students" && <StudentsTab cohortId={id} cohort={cohort} isAdmin={isAdmin} marks={marks.filter((m) => held.some((s) => s.id === m.sessionId))} heldCount={held.length} assignmentIds={work.map((w) => w.id)} learning={learning} />}

      {tab === "announcements" && (
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.3fr]">
          <Card title="Post an announcement">
            <ActionForm action={postAnnouncement.bind(null, id)} resetOnSuccess>
              <Input label="Title" name="title" required />
              <RichTextEditor label="Message" name="body" minHeight={160} hint="Jot a few notes and let AI write the message, if you like." />
              {aiWriting && <AiDraftButton draft={draftAnnouncement.bind(null, id)} label="Write it with AI" />}
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

      {tab === "settings" && isAdmin && <SettingsTab cohort={cohort} course={course} currencies={settings.currencies} />}
    </>
  );
}

function OverviewTab({ base, cohort, sessions, needsAttendance, toGrade, studentCount, publishedLessons, assignmentCount, timeZone, now }: { base: string; cohort: Cohort; sessions: ClassSession[]; needsAttendance: ClassSession[]; toGrade: number; studentCount: number; publishedLessons: number; assignmentCount: number; timeZone: string; now: Date }) {
  const next = sessions.find((s) => !s.cancelled && new Date(s.endsAt) >= now);
  const live = next && new Date(next.startsAt).getTime() - 15 * 60_000 <= now.getTime();
  const todos: { text: string; href: string; action: string }[] = [
    ...(needsAttendance.length ? [{ text: `${needsAttendance.length} live ${needsAttendance.length === 1 ? "class needs" : "classes need"} attendance`, href: `${base}?tab=classes`, action: "Take attendance" }] : []),
    ...(toGrade ? [{ text: `${toGrade} ${toGrade === 1 ? "submission" : "submissions"} to grade`, href: `${base}?tab=assignments`, action: "Grade" }] : []),
    ...(!sessions.length ? [{ text: "No live classes on the timetable yet", href: `${base}?tab=classes`, action: "Add classes" }] : []),
    ...(!publishedLessons ? [{ text: "No published lessons yet", href: `${base}?tab=lessons`, action: "Add lessons" }] : []),
  ];
  const facts: [string, string][] = [
    ["Students", `${studentCount}${cohort.capacity ? ` of ${cohort.capacity}` : ""}`],
    ["Live classes held", `${sessions.filter((s) => !s.cancelled && new Date(s.endsAt) < now).length} of ${sessions.filter((s) => !s.cancelled).length}`],
    ["Lessons published", String(publishedLessons)],
    ["Assignments", String(assignmentCount)],
  ];
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-6">
        <Card title="Next live class">
          {next ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-ink">{next.title} {live && <Badge tone="green">Happening now</Badge>}</p>
                <p className="text-sm text-muted">{formatSessionRange(next.startsAt, next.endsAt, timeZone)}{live ? "" : ` · ${untilLabel(next.startsAt, now)}`}</p>
                {next.mode === "physical" && next.venue && <p className="text-sm text-body">{next.venue}</p>}
              </div>
              <span className="flex flex-wrap gap-2">
                {next.mode === "virtual" && next.meetingUrl && <a href={next.meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent-dark"><VideoIcon className="size-4" /> Join</a>}
                <Link href={`/teach/sessions/${next.id}`} className="inline-flex h-9 items-center rounded-lg border border-edge-strong bg-white px-3.5 text-sm font-semibold text-ink hover:bg-page">{live ? "Take attendance" : "Edit class"}</Link>
              </span>
            </div>
          ) : <p className="text-sm text-muted">Nothing scheduled. <Link href={`${base}?tab=classes`} className="font-semibold text-accent">Add live classes</Link>.</p>}
        </Card>
        <Card title="To do">
          {todos.length ? (
            <ul className="-my-2 flex flex-col divide-y divide-line">
              {todos.map((t) => (
                <li key={t.text} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-[15px] font-medium text-ink">{t.text}</span>
                  <Link href={t.href} className="text-sm font-semibold text-accent hover:text-accent-dark">{t.action} →</Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">All caught up.</p>}
        </Card>
      </div>
      <Card title="At a glance">
        <dl className="-my-2 divide-y divide-line">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-3"><dt className="text-sm text-muted">{label}</dt><dd className="font-semibold text-ink">{value}</dd></div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function ClassesTimetable({ sessions, students, marks, timeZone, now }: { sessions: ClassSession[]; students: { id: number; name: string; status: string }[]; marks: Mark[]; timeZone: string; now: Date }) {
  const active = students.filter((s) => s.status === "active");
  return (
    <Card title="Timetable">
      {sessions.length ? (
        <ul className="-my-4 divide-y divide-line">
          {sessions.map((s) => {
            const ended = new Date(s.endsAt) < now;
            const started = new Date(s.startsAt) <= now;
            const mine = marks.filter((m) => m.sessionId === s.id);
            const came = mine.filter((m) => m.status === "present" || m.status === "late").length;
            const due = started && !s.cancelled && active.length > 0;
            return (
              <SessionRow key={s.id} session={s} timeZone={timeZone} now={now} showActions={false}>
                {due && (
                  <details className="group rounded-[5px] border border-edge">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      {mine.length ? <span className="text-body">Attendance: <strong className="text-ink">{came}/{mine.length}</strong> present</span> : <Badge tone="amber">Attendance not taken</Badge>}
                      <span className="font-semibold text-accent group-open:hidden">{mine.length ? "Edit attendance" : "Take attendance"}</span>
                      <span className="hidden font-semibold text-muted group-open:inline">Close</span>
                    </summary>
                    <div className="border-t border-line px-3 pb-3 pt-1"><AttendanceForm sessionId={s.id} students={active} marks={mine} /></div>
                  </details>
                )}
                <Link href={`/teach/sessions/${s.id}`} className="w-fit text-sm font-semibold text-accent hover:text-accent-dark">{ended ? "Edit class or add recording →" : "Edit class →"}</Link>
              </SessionRow>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={CalendarIcon} title="No live classes yet">Add the first one. You can repeat it weekly to build the whole timetable at once.</EmptyState>
      )}
    </Card>
  );
}

function AddClassCard({ cohortId, cohort, sessions, timeZone }: { cohortId: number; cohort: Cohort; sessions: ClassSession[]; timeZone: string }) {
  // A sensible default for the next class: a week after the last one, same time.
  const last = sessions.at(-1);
  const nextStart = last ? new Date(new Date(last.startsAt).getTime() + 7 * 86_400_000) : null;
  return (
    <Card title="Add a live class">
      <ActionForm action={createSessions.bind(null, cohortId)} resetOnSuccess>
        <SessionFields
          repeat
          defaults={{
            mode: cohort.deliveryMode === "physical" ? "physical" : "virtual",
            venue: cohort.venue,
            startsAt: nextStart ? toZonedInput(nextStart, timeZone) : undefined,
            durationMinutes: last ? Math.round((+new Date(last.endsAt) - +new Date(last.startsAt)) / 60000) : 120,
            meetingUrl: [...sessions].reverse().find((s) => s.meetingUrl)?.meetingUrl ?? "",
          }}
        />
        <SubmitButton pendingText="Adding…">Add to timetable</SubmitButton>
      </ActionForm>
    </Card>
  );
}

async function SettingsTab({ cohort, course, currencies }: { cohort: Cohort; course: Course; currencies: Parameters<typeof CohortForm>[0]["currencies"] }) {
  const db = await getDb();
  const [staff, assigned] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(inArray(users.role, ["instructor", "admin"])),
    db.select({ userId: cohortInstructors.userId }).from(cohortInstructors).where(eq(cohortInstructors.cohortId, cohort.id)),
  ]);
  const internship = course.kind === "internship";
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Card title={internship ? "Intake settings" : "Cohort settings"}>
        <CohortForm action={updateCohort.bind(null, cohort.id, course.id)} cohort={cohort} instructors={staff} assigned={assigned.map((a) => a.userId)} currencies={currencies} internship={internship} />
      </Card>
      <div className="flex justify-end"><DeleteButton action={deleteCohort.bind(null, cohort.id)} label={internship ? "Delete intake" : "Delete cohort"} /></div>
    </div>
  );
}

/** The cohort's view of the shared curriculum: when each module opens for this cohort and how far students have got. Editing happens in the curriculum builder. */
async function LearningTab({ cohortId, courseId, learning, students, editHref }: { editHref: string; courseId: number; cohortId: number; learning: { module: typeof courseModules.$inferSelect; lesson: typeof lessons.$inferSelect | null; releaseAt: Date | null }[]; students: Awaited<ReturnType<typeof getCohortStudents>> }) {
  const db = await getDb();
  const timeZone = (await getSettings()).timezone;
  const now = new Date();
  const modules = [...new Map(learning.map((row) => [row.module.id, { module: row.module, releaseAt: row.releaseAt }])).values()].sort((a, b) => a.module.position - b.module.position || a.module.id - b.module.id);
  const lessonsOf = (moduleId: number) => learning.flatMap((row) => (row.module.id === moduleId && row.lesson ? [row.lesson] : [])).sort((a, b) => a.position - b.position || a.id - b.id);
  const lessonIds = learning.flatMap((row) => (row.lesson?.published ? [row.lesson.id] : []));
  const studentIds = students.map((student) => student.id);
  const completions = studentIds.length && lessonIds.length ? await db.select({ userId: enrollments.userId, lessonId: lessonProgress.lessonId }).from(lessonProgress).innerJoin(enrollments, eq(enrollments.id, lessonProgress.enrollmentId)).where(and(eq(enrollments.cohortId, cohortId), inArray(enrollments.userId, studentIds), inArray(lessonProgress.lessonId, lessonIds), sql`${lessonProgress.completedAt} is not null`)) : [];
  const editLink = <Link href={editHref} className={buttonClass.small}><EditIcon className="size-4" /> Edit curriculum</Link>;

  if (!lessonIds.length) {
    return (
      <EmptyState title={modules.length ? "No published lessons yet" : "No curriculum yet"} icon={BookIcon} action={editLink}>
        {modules.length ? "Lessons are added, but none are published, so students don't see anything yet." : "Build the course's modules, lessons and quizzes once, and every cohort of the course uses them."}
      </EmptyState>
    );
  }
  const quizReport = await cohortQuizReport(cohortId, courseId);
  return (
    <div className="flex flex-col gap-6">
      <Card title="Schedule" action={editLink}>
        <p className="mb-5 text-sm text-muted">Each module opens for this cohort on its release date (leave it blank to open straight away). Lessons, quizzes and their order are shared by every cohort and changed with Edit curriculum.</p>
        <ol className="flex flex-col gap-4">
          {modules.map(({ module, releaseAt }, index) => {
            const items = lessonsOf(module.id);
            const live = items.filter((lesson) => lesson.published);
            const drafts = items.length - live.length;
            const open = !releaseAt || releaseAt <= now;
            return (
              <li key={module.id} className="rounded-[5px] border border-edge">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-panel/60 px-4 py-3.5">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-accent">{String(index + 1).padStart(2, "0")}</span>
                      <h3 className="font-display font-bold text-ink">{module.title}</h3>
                      {!live.length ? <Badge>Not visible yet</Badge> : open ? <Badge tone="green">Open</Badge> : <Badge tone="amber">Opens {formatDateTime(releaseAt!, timeZone, { zone: false })}</Badge>}
                    </span>
                    {module.summary && <p className="text-sm text-muted">{module.summary}</p>}
                  </div>
                  <ActionForm action={setModuleRelease.bind(null, cohortId, module.id)} className="flex flex-wrap items-end gap-2">
                    <Input label="Release date" name="releaseAt" type="datetime-local" defaultValue={toZonedInput(releaseAt, timeZone)} />
                    <SubmitButton>Save</SubmitButton>
                  </ActionForm>
                </div>
                <ul className="divide-y divide-line px-4">
                  {live.map((lesson) => {
                    const n = completions.filter((item) => item.lessonId === lesson.id).length;
                    return (
                      <li key={lesson.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="min-w-0 truncate font-medium text-ink">{lesson.title}</span>
                        <span className="shrink-0 text-muted">{n}/{students.length} complete</span>
                      </li>
                    );
                  })}
                  {!live.length && <li className="py-2.5 text-sm text-muted">No published lessons in this module.</li>}
                </ul>
                {drafts > 0 && <p className="border-t border-line px-4 py-2 text-xs text-muted">{drafts} draft{drafts === 1 ? "" : "s"} hidden from students.</p>}
              </li>
            );
          })}
        </ol>
      </Card>
      {quizReport.length > 0 && (
        <Card title="Quiz results" padded={false}>
          <ul className="divide-y divide-line">
            {quizReport.map((row) => (
              <li key={row.quizId} className="flex flex-col gap-1.5 px-5 py-4 md:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{row.lessonTitle}</span>
                  <span className="flex flex-wrap gap-2 text-sm">
                    <span className="text-muted">{row.attempted}/{students.length} attempted</span>
                    <Badge tone={row.attempted && row.passed === row.attempted ? "green" : "accent"}>{row.passed} passed</Badge>
                    {row.averageBest !== null && <Badge>avg best {row.averageBest}%</Badge>}
                  </span>
                </div>
                {row.hardest && <p className="text-sm text-muted">Most missed ({row.hardest.percentCorrect}% correct): <span className="text-body">{row.hardest.prompt}</span></p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Student progress">
        {students.length ? <ul className="divide-y divide-line">{students.map((student) => { const done = new Set(completions.filter((item) => item.userId === student.id).map((item) => item.lessonId)).size; const pct = Math.round((done / lessonIds.length) * 100); return <li key={student.id} className="py-3"><div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-semibold text-ink">{student.name}</span><span className="text-muted">{done}/{lessonIds.length} · {pct}%</span></div><div className="h-2 overflow-hidden rounded-full bg-page"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div></li>; })}</ul> : <p className="text-sm text-muted">No students are enrolled yet.</p>}
      </Card>
    </div>
  );
}

async function AssignmentsTab({ cohortId, work, studentCount, timeZone, learning }: { cohortId: number; work: (typeof assignments.$inferSelect)[]; studentCount: number; timeZone: string; learning: { module: typeof courseModules.$inferSelect; lesson: typeof lessons.$inferSelect | null; releaseAt: Date | null }[] }) {
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
          <RichTextEditor label="Instructions" name="instructions" minHeight={200} placeholder="What should students do, and how will it be assessed?" />
          <Select label="Place after lesson" name="lessonId" defaultValue="" hint="Optional. This puts the cohort assignment into the reusable learning sequence." options={[{ value: "", label: "Not linked to a lesson" }, ...learning.filter((row) => row.lesson).map((row) => ({ value: String(row.lesson!.id), label: `${row.module.title} — ${row.lesson!.title}` }))]} />
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

type LearningRow = { module: typeof courseModules.$inferSelect; lesson: typeof lessons.$inferSelect | null; releaseAt: Date | null };

/** Everyone on the cohort in one list: attendance, lessons, work and certificates. Admins can also add, complete and remove students here. */
async function StudentsTab({ cohortId, cohort, isAdmin, marks, heldCount, assignmentIds, learning }: { cohortId: number; cohort: Cohort; isAdmin: boolean; marks: Mark[]; heldCount: number; assignmentIds: number[]; learning: LearningRow[] }) {
  const db = await getDb();
  const roster = await db.select({ enrollment: enrollments, user: { id: users.id, name: users.name, email: users.email } }).from(enrollments).innerJoin(users, eq(users.id, enrollments.userId)).where(and(eq(enrollments.cohortId, cohortId), inArray(enrollments.status, isAdmin ? ["active", "completed", "cancelled"] : ["active", "completed"]))).orderBy(asc(users.name));
  const ids = roster.map((r) => r.user.id);
  const lessonIds = learning.flatMap((row) => (row.lesson?.published ? [row.lesson.id] : []));
  const enrollmentIds = roster.map((r) => r.enrollment.id);
  const [grades, done, issued, eligibility] = await Promise.all([
    assignmentIds.length && ids.length ? db.select({ userId: submissions.userId, status: submissions.status, score: submissions.score, max: assignments.maxScore }).from(submissions).innerJoin(assignments, eq(assignments.id, submissions.assignmentId)).where(and(inArray(submissions.assignmentId, assignmentIds), inArray(submissions.userId, ids))) : [],
    lessonIds.length && enrollmentIds.length ? db.select({ enrollmentId: lessonProgress.enrollmentId, n: count() }).from(lessonProgress).where(and(inArray(lessonProgress.enrollmentId, enrollmentIds), inArray(lessonProgress.lessonId, lessonIds), sql`${lessonProgress.completedAt} is not null`)).groupBy(lessonProgress.enrollmentId) : [],
    enrollmentIds.length ? db.select().from(certificates).where(inArray(certificates.enrollmentId, enrollmentIds)) : [],
    isAdmin ? Promise.all(roster.map(async ({ enrollment }) => [enrollment.id, await certificateEligibility(enrollment.id)] as const)).then((rows) => new Map(rows)) : new Map<number, Awaited<ReturnType<typeof certificateEligibility>>>(),
  ]);
  const activeIds = roster.filter((r) => r.enrollment.status === "active").map((r) => r.enrollment.id);
  const enrolled = roster.filter((r) => r.enrollment.status !== "cancelled");

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <details className="rounded-[14px] border border-edge bg-white px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-accent">Add a student</summary>
          <ActionForm action={addStudentToCohort.bind(null, cohortId)} resetOnSuccess className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-muted">Enrol someone without online payment (e.g. scholarship or bank transfer). New emails get an account and an invitation to set a password.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Email" name="email" type="email" required />
              <Input label="Name (for new accounts)" name="name" />
            </div>
            <div><SubmitButton pendingText="Adding…">Add student</SubmitButton></div>
          </ActionForm>
        </details>
      )}
      {roster.length ? (
        <DataTable>
          <thead><tr><th>Student</th><th>Attendance</th><th>Lessons</th><th>Assignments</th><th>Average</th><th>Status</th>{isAdmin && <th><span className="sr-only">Actions</span></th>}</tr></thead>
          <tbody>
            {roster.map(({ enrollment, user }) => {
              const mine = marks.filter((m) => m.userId === user.id);
              const attended = mine.filter((m) => m.status === "present" || m.status === "late").length;
              const work = grades.filter((g) => g.userId === user.id);
              const scored = work.filter((g) => g.status === "graded" && g.score !== null);
              const avg = scored.length ? Math.round(scored.reduce((a, g) => a + (g.score! / g.max) * 100, 0) / scored.length) : null;
              const lessonsDone = done.find((d) => d.enrollmentId === enrollment.id)?.n ?? 0;
              const certificate = issued.find((c) => c.enrollmentId === enrollment.id && !c.revokedAt);
              const check = eligibility.get(enrollment.id);
              return (
                <tr key={enrollment.id} className={enrollment.status === "cancelled" ? "opacity-60" : undefined}>
                  <td>
                    <span className="flex max-w-xs flex-col">
                      {isAdmin ? <Link href={`/admin/users/${user.id}`} className="font-semibold text-ink hover:text-accent">{user.name}</Link> : <span className="font-semibold text-ink">{user.name}</span>}
                      <a href={`mailto:${user.email}`} className="truncate text-sm text-accent">{user.email}</a>
                      {isAdmin && <span className="text-xs text-muted">{enrollment.source} · joined {relativeTime(enrollment.createdAt)}</span>}
                      {check && !check.eligible && enrollment.status !== "cancelled" && <span className="mt-1 text-xs text-amber-800">Certificate pending: {check.reasons.join(" ")}</span>}
                    </span>
                  </td>
                  <td>{heldCount ? (mine.length ? `${attended}/${mine.length} (${Math.round((attended / mine.length) * 100)}%)` : "Not taken") : "–"}</td>
                  <td>{lessonIds.length ? `${lessonsDone}/${lessonIds.length}` : "–"}</td>
                  <td>{work.length}/{assignmentIds.length}</td>
                  <td className="font-semibold">{avg === null ? "–" : `${avg}%`}</td>
                  <td>
                    <span className="flex flex-col items-start gap-1">
                      <StatusBadge status={enrollment.status} />
                      {certificate && <Link href={`/certificates/${certificate.code}`} target="_blank" className="text-xs font-semibold text-accent">Certificate</Link>}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <span className="flex flex-wrap justify-end gap-2">
                        {enrollment.status === "active" && <ActionButton action={setEnrollmentStatus.bind(null, enrollment.id, "completed")} variant="primary" pendingText="Completing…">{check?.eligible ? "Complete & issue" : "Mark completed"}</ActionButton>}
                        {enrollment.status === "completed" && !certificate && check?.eligible && <ActionButton action={issueCertificate.bind(null, enrollment.id)} variant="primary" pendingText="Issuing…">Issue certificate</ActionButton>}
                        {enrollment.status === "active" && <ActionButton action={setEnrollmentStatus.bind(null, enrollment.id, "cancelled")} variant="danger" pendingText="…">Remove</ActionButton>}
                        {enrollment.status === "cancelled" && <ActionButton action={setEnrollmentStatus.bind(null, enrollment.id, "active")} pendingText="…">Restore</ActionButton>}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      ) : <EmptyState icon={UsersIcon} title="No students yet">Students appear here once they enrol and pay{isAdmin ? ", or when you add them above" : ", or when an admin adds them"}.</EmptyState>}
      {isAdmin && activeIds.length > 0 && (
        <Card title="End of course">
          <p className="mb-4 text-sm text-muted">Mark every active student as completed when the {cohort.name} run finishes. Completed students keep access to their materials and feedback but stop receiving reminders; eligible students get their certificate.</p>
          <ActionButton action={completeAll.bind(null, activeIds)} pendingText="Updating…">Mark {activeIds.length} {activeIds.length === 1 ? "student" : "students"} as completed</ActionButton>
        </Card>
      )}
      {enrolled.length > 0 && (
        <details className="rounded-[14px] border border-edge bg-white px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-accent">Copy email addresses</summary>
          <textarea readOnly className="mt-3 w-full rounded-lg border border-edge bg-panel p-3 font-mono text-sm" rows={3} defaultValue={enrolled.map((r) => r.user.email).join(", ")} aria-label="Email addresses for this cohort" />
        </details>
      )}
    </div>
  );
}

async function completeAll(ids: number[]) {
  "use server";
  for (const id of ids) await setEnrollmentStatus(id, "completed");
}
