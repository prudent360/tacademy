import type { Metadata } from "next";
import Link from "next/link";
import { and, count, eq, gte, inArray, lte } from "drizzle-orm";
import { CalendarIcon, ClipboardIcon, ClockIcon, LayersIcon, MegaphoneIcon, PinIcon, UsersIcon, VideoIcon } from "@/components/icons";
import { Countdown } from "@/components/portal/countdown";
import { BannerButton, DateChip, GreetingBanner, Panel, PanelEmpty, ProgressBar, QuickAction, StatTile } from "@/components/portal/dash";
import { Badge, ModeBadge, Notice } from "@/components/ui";
import { getDb } from "@/db";
import { assignments, attendance, classSessions, enrollments, submissions } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getSettings, getTeachingCohortIds } from "@/lib/data";
import { upcomingSessionsFor } from "@/lib/student";
import { attendanceToDo, cohortsWithStats, gradingQueue } from "@/lib/teach";
import { formatDateOnly, formatDayMonth, formatSessionRange, greeting, relativeTime, thisWeek, untilLabel } from "@/lib/time";
import { MODE_LABEL, firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Teaching" };

export default async function TeachHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const [user, settings, { denied }] = await Promise.all([requireRole("admin", "instructor"), getSettings(), searchParams]);
  const tz = settings.timezone;
  const now = new Date();
  const db = await getDb();
  const ids = await getTeachingCohortIds(user);
  const week = thisWeek(now);
  const today = new Date().toISOString().slice(0, 10);

  const [rows, queue, upcoming, sessions, marks, deadlines, unmarked] = await Promise.all([
    cohortsWithStats(ids),
    gradingQueue(ids),
    upcomingSessionsFor(ids, 8),
    ids.length ? db.select({ id: classSessions.id, cohortId: classSessions.cohortId, startsAt: classSessions.startsAt, endsAt: classSessions.endsAt, cancelled: classSessions.cancelled }).from(classSessions).where(inArray(classSessions.cohortId, ids)) : [],
    ids.length ? db.select({ cohortId: classSessions.cohortId, status: attendance.status }).from(attendance).innerJoin(classSessions, eq(classSessions.id, attendance.sessionId)).where(inArray(classSessions.cohortId, ids)) : [],
    ids.length ? db.select().from(assignments).where(and(inArray(assignments.cohortId, ids), eq(assignments.published, true), gte(assignments.dueAt, now), lte(assignments.dueAt, new Date(now.getTime() + 14 * 86_400_000)))).orderBy(assignments.dueAt).limit(5) : [],
    attendanceToDo(ids),
  ]);
  const deadlineIds = deadlines.map((d) => d.id);
  const [subCounts, studentCounts] = await Promise.all([
    deadlineIds.length ? db.select({ assignmentId: submissions.assignmentId, n: count() }).from(submissions).where(inArray(submissions.assignmentId, deadlineIds)).groupBy(submissions.assignmentId) : [],
    ids.length ? db.select({ cohortId: enrollments.cohortId, n: count() }).from(enrollments).where(and(inArray(enrollments.cohortId, ids), eq(enrollments.status, "active"))).groupBy(enrollments.cohortId) : [],
  ]);

  const current = rows.filter((r) => !r.cohort.endDate || r.cohort.endDate >= today);
  const past = rows.filter((r) => r.cohort.endDate && r.cohort.endDate < today);
  const live = upcoming.filter(({ session }) => !session.cancelled);
  const next = live[0];
  const classesThisWeek = sessions.filter((s) => !s.cancelled && s.startsAt >= week.start && s.startsAt < week.end).length;
  const totalStudents = current.reduce((a, r) => a + r.students, 0);
  const courseFor = new Map(rows.map((r) => [r.cohort.id, r.course.title]));
  const attendanceRate = (cohortId?: number) => {
    const list = marks.filter((m) => cohortId === undefined || m.cohortId === cohortId);
    if (!list.length) return null;
    return Math.round((list.filter((m) => m.status === "present" || m.status === "late").length / list.length) * 100);
  };
  const overallAttendance = attendanceRate();

  return (
    <>
      <GreetingBanner
        tone="instructor"
        title={`${greeting(tz, now)}, ${firstName(user.name)}`}
        subtitle={next ? <>Next up: <strong className="text-white">{next.session.title}</strong> ({next.course.title}), {formatSessionRange(next.session.startsAt, next.session.endsAt, tz)}.</> : "No upcoming live classes. Add some from a cohort's Live classes tab."}
        aside={next ? (
          <div className="flex flex-col gap-3 rounded-[5px] border border-white/15 bg-white/[0.07] p-4 backdrop-blur">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-light">
              {next.session.mode === "virtual" ? <VideoIcon className="size-4" /> : <PinIcon className="size-4" />} {MODE_LABEL[next.session.mode]} · {new Date(next.session.startsAt) <= now ? "live now" : "starts in"}
            </span>
            <Countdown to={new Date(next.session.startsAt).toISOString()} />
            <Link href={`/teach/sessions/${next.session.id}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-surface text-sm font-semibold text-accent-ink hover:bg-accent-soft">Open live class</Link>
          </div>
        ) : undefined}
      >
        <BannerButton href="/teach/grading"><ClipboardIcon className="size-4" /> Grade submissions{queue.length ? ` (${queue.length})` : ""}</BannerButton>
        <BannerButton href="/teach/schedule" variant="ghost"><CalendarIcon className="size-4" /> Timetable</BannerButton>
      </GreetingBanner>

      {denied && <Notice tone="amber">You don&apos;t teach that cohort. Ask an admin to add you as an instructor.</Notice>}

      {unmarked.length > 0 && (
        <Panel title={`Attendance to take (${unmarked.length})`} icon={UsersIcon}>
          <ul className="flex flex-col gap-2.5">
            {unmarked.slice(0, 5).map(({ session, course, cohortName }) => (
              <li key={session.id}>
                <Link href={`/teach/sessions/${session.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[5px] border border-amber-200 bg-amber-50/60 p-3.5 hover:border-amber-300">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-semibold text-ink">{session.title}</span>
                    <span className="truncate text-sm text-muted">{course.title}: {cohortName} · {formatSessionRange(session.startsAt, session.endsAt, tz)}</span>
                  </span>
                  <span className="text-sm font-semibold text-accent-ink">Take attendance →</span>
                </Link>
              </li>
            ))}
          </ul>
          {unmarked.length > 5 && <p className="mt-3 text-sm text-muted">And {unmarked.length - 5} more. Open each cohort&apos;s Live classes tab to catch up.</p>}
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active cohorts" value={current.length} icon={LayersIcon} tone="purple" hint={past.length ? `${past.length} finished` : undefined} />
        <StatTile label="Students" value={totalStudents} icon={UsersIcon} tone="cyan" hint={overallAttendance === null ? undefined : `${overallAttendance}% attendance`} />
        <StatTile label="Waiting for feedback" value={queue.length} icon={ClipboardIcon} tone={queue.length ? "amber" : "green"} href="/teach/grading" hint={queue[0] ? `Oldest ${relativeTime(queue[0].submission.submittedAt)}` : "All caught up"} />
        <StatTile label="Live classes this week" value={classesThisWeek} icon={CalendarIcon} tone="navy" href="/teach/schedule" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Upcoming live classes" href="/teach/schedule" linkLabel="Timetable" icon={CalendarIcon}>
          {live.length ? (
            <ul className="flex flex-col gap-2.5">
              {live.slice(0, 5).map(({ session, course }) => {
                const d = formatDayMonth(session.startsAt, tz);
                const started = new Date(session.startsAt) <= now;
                return (
                  <li key={session.id}>
                    <Link href={`/teach/sessions/${session.id}`} className="flex items-center gap-4 rounded-[5px] border border-edge p-3.5 hover:border-accent-muted">
                      <DateChip day={d.day} month={d.month} />
                      <span className="flex min-w-0 grow flex-col gap-0.5">
                        <span className="truncate font-semibold text-ink">{session.title}</span>
                        <span className="truncate text-sm text-muted">{course.title} · {formatSessionRange(session.startsAt, session.endsAt, tz)}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <ModeBadge mode={session.mode} />
                          <span className={`text-xs font-semibold ${started ? "text-emerald-700" : "text-muted"}`}><ClockIcon className="mr-1 inline size-3.5" />{started ? "Happening now: take attendance" : `Starts ${untilLabel(session.startsAt, now)}`}</span>
                        </span>
                      </span>
                      <span className="hidden text-right text-sm sm:block"><span className="block font-display text-lg font-bold text-ink">{studentCounts.find((s) => s.cohortId === session.cohortId)?.n ?? 0}</span><span className="text-xs text-muted">students</span></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <PanelEmpty icon={CalendarIcon}>No upcoming live classes.</PanelEmpty>}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Grading queue" href="/teach/grading" icon={ClipboardIcon}>
            {queue.length ? (
              <ul className="flex flex-col gap-2.5">
                {queue.slice(0, 4).map(({ submission, assignment, student }) => {
                  const late = assignment.dueAt && new Date(submission.submittedAt) > new Date(assignment.dueAt);
                  return (
                    <li key={submission.id}>
                      <Link href={`/teach/submissions/${submission.id}`} className="flex items-center justify-between gap-3 rounded-[5px] border border-edge p-3.5 hover:border-accent-muted">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-semibold text-ink">{student.name}</span>
                          <span className="truncate text-sm text-muted">{assignment.title}</span>
                          <span className="text-xs text-muted">{relativeTime(submission.submittedAt)}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1.5">{late && <Badge tone="amber">Late</Badge>}<span className="text-sm font-semibold text-accent-ink">Review →</span></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : <PanelEmpty icon={ClipboardIcon}>Nothing to grade. Nice work.</PanelEmpty>}
          </Panel>

          <Panel title="Upcoming deadlines" icon={ClockIcon}>
            {deadlines.length ? (
              <ul className="flex flex-col gap-4">
                {deadlines.map((a) => {
                  const total = studentCounts.find((s) => s.cohortId === a.cohortId)?.n ?? 0;
                  const got = subCounts.find((s) => s.assignmentId === a.id)?.n ?? 0;
                  return (
                    <li key={a.id}>
                      <Link href={`/teach/assignments/${a.id}`} className="flex flex-col gap-2">
                        <span className="flex items-start justify-between gap-3">
                          <span className="flex min-w-0 flex-col"><span className="truncate font-semibold text-ink hover:text-accent-ink">{a.title}</span><span className="truncate text-xs text-muted">{courseFor.get(a.cohortId)} · due {untilLabel(a.dueAt!, now)}</span></span>
                        </span>
                        <ProgressBar value={got} max={total} tone="cyan" label="Submitted" detail={`${got}/${total}`} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : <PanelEmpty icon={ClockIcon}>No deadlines in the next two weeks.</PanelEmpty>}
          </Panel>
        </div>
      </div>

      <Panel title={user.role === "admin" ? "All cohorts" : "My cohorts"} icon={LayersIcon}>
        {current.length ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {current.map((r) => {
              const list = sessions.filter((s) => s.cohortId === r.cohort.id && !s.cancelled);
              const done = list.filter((s) => s.endsAt < now).length;
              const rate = attendanceRate(r.cohort.id);
              return (
                <Link key={r.cohort.id} href={`/teach/cohorts/${r.cohort.id}`} className="group flex flex-col gap-4 rounded-[5px] border border-edge p-5 transition hover:-translate-y-0.5 hover:border-accent-muted hover:bg-panel">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ModeBadge mode={r.cohort.deliveryMode} />
                    {r.toGrade > 0 && <Badge tone="cyan">{r.toGrade} to grade</Badge>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="font-display text-[17px] font-bold text-ink group-hover:text-accent-ink">{r.course.title}</p>
                    <p className="text-sm text-muted">{r.cohort.name}{r.cohort.startDate ? ` · ${formatDateOnly(r.cohort.startDate)} – ${formatDateOnly(r.cohort.endDate)}` : ""}</p>
                  </div>
                  <ProgressBar value={done} max={list.length} label="Live classes held" detail={list.length ? `${done}/${list.length}` : "No timetable yet"} />
                  <div className="grid grid-cols-3 gap-2 border-t border-line pt-4 text-sm">
                    <span className="flex flex-col"><span className="text-xs text-muted">Students</span><span className="font-semibold text-ink">{r.students}</span></span>
                    <span className="flex flex-col"><span className="text-xs text-muted">Attendance</span><span className="font-semibold text-ink">{rate === null ? "–" : `${rate}%`}</span></span>
                    <span className="flex flex-col"><span className="text-xs text-muted">Next class</span><span className="truncate font-semibold text-ink">{r.nextSession ? untilLabel(r.nextSession.startsAt, now).replace("in ", "") : "–"}</span></span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : <PanelEmpty icon={LayersIcon}>{user.role === "admin" ? "Create a course and a cohort under Courses & cohorts." : "An admin will assign you to cohorts; they'll appear here."}</PanelEmpty>}
        {past.length > 0 && (
          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-accent-ink">Finished cohorts ({past.length})</summary>
            <ul className="mt-3 flex flex-col gap-2">
              {past.map((r) => <li key={r.cohort.id}><Link href={`/teach/cohorts/${r.cohort.id}`} className="text-sm font-medium text-body hover:text-accent-ink">{r.course.title}: {r.cohort.name}</Link></li>)}
            </ul>
          </details>
        )}
      </Panel>

      {current.length > 0 && (
        <Panel title="Quick actions">
          <div className="grid gap-3 md:grid-cols-3">
            <QuickAction href={`/teach/cohorts/${current[0].cohort.id}?tab=classes`} icon={CalendarIcon} title="Add a live class" text={`To ${current[0].course.title}`} tone="purple" />
            <QuickAction href={`/teach/cohorts/${current[0].cohort.id}?tab=assignments`} icon={ClipboardIcon} title="Set an assignment" text="Students are emailed instantly" tone="cyan" />
            <QuickAction href={`/teach/cohorts/${current[0].cohort.id}?tab=announcements`} icon={MegaphoneIcon} title="Post an announcement" text="In-app and by email" tone="navy" />
          </div>
        </Panel>
      )}
    </>
  );
}
