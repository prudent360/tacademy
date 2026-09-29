import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import {
  AwardIcon, BookIcon, CalendarIcon, CardIcon, ClipboardIcon, ClockIcon, MegaphoneIcon, MessageIcon, PinIcon, SparkIcon, UserIcon, VideoIcon,
} from "@/components/icons";
import { Countdown } from "@/components/portal/countdown";
import { BannerButton, DateChip, GreetingBanner, Panel, PanelEmpty, ProgressBar, QuickAction, StatTile } from "@/components/portal/dash";
import { Badge, ModeBadge, Notice } from "@/components/ui";
import { getDb } from "@/db";
import { attendance, classSessions, cohorts as cohortTable, courseModules, enrollments, lessonProgress, lessons, moduleReleases, payments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSettings, getStudentCohorts } from "@/lib/data";
import { STATE_LABEL, announcementsFor, assignmentState, assignmentsForStudent, upcomingSessionsFor } from "@/lib/student";
import { paymentBalanceFor } from "@/lib/payments";
import { PART_PAYMENT_PLANS } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { formatDateOnly, formatDayMonth, formatSessionRange, greeting, relativeTime, thisWeek, untilLabel } from "@/lib/time";
import { MODE_LABEL, firstName } from "@/lib/utils";
import { XP, xpForUser } from "@/lib/xp";

export const metadata: Metadata = { title: "Dashboard" };

export default async function StudentDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [user, settings, { welcome }] = await Promise.all([requireUser(), getSettings(), searchParams]);
  const tz = settings.timezone;
  const now = new Date();
  const db = await getDb();

  const cohorts = await getStudentCohorts(user.id);
  const cohortIds = cohorts.map((c) => c.cohort.id);
  const activeIds = cohorts.filter((c) => c.enrollment.status === "active").map((c) => c.cohort.id);

  const [upcoming, work, news, allSessions, marks, studentPayments, xp] = await Promise.all([
    upcomingSessionsFor(activeIds, 8),
    assignmentsForStudent(user.id, cohortIds),
    announcementsFor(activeIds, 3),
    cohortIds.length ? db.select({ id: classSessions.id, cohortId: classSessions.cohortId, endsAt: classSessions.endsAt, startsAt: classSessions.startsAt, cancelled: classSessions.cancelled }).from(classSessions).where(inArray(classSessions.cohortId, cohortIds)) : [],
    cohortIds.length ? db.select({ sessionId: attendance.sessionId, status: attendance.status }).from(attendance).where(eq(attendance.userId, user.id)) : [],
    db.select().from(payments).where(eq(payments.userId, user.id)),
    xpForUser(user.id),
  ]);
  const learningRows = activeIds.length ? await db.select({ cohortId: enrollments.cohortId, lesson: lessons, courseModule: courseModules, completedAt: lessonProgress.completedAt, releaseAt: moduleReleases.releaseAt })
    .from(enrollments)
    .innerJoin(cohortTable, eq(cohortTable.id, enrollments.cohortId))
    .innerJoin(courseModules, eq(courseModules.courseId, cohortTable.courseId))
    .innerJoin(lessons, eq(lessons.moduleId, courseModules.id))
    .leftJoin(lessonProgress, and(eq(lessonProgress.enrollmentId, enrollments.id), eq(lessonProgress.lessonId, lessons.id)))
    .leftJoin(moduleReleases, and(eq(moduleReleases.cohortId, enrollments.cohortId), eq(moduleReleases.moduleId, courseModules.id)))
    .where(and(eq(enrollments.userId, user.id), inArray(enrollments.cohortId, activeIds), eq(courseModules.published, true), eq(lessons.published, true)))
    .orderBy(courseModules.position, lessons.position) : [];
  const nextLearning = learningRows.find((row) => !row.completedAt && (!row.releaseAt || row.releaseAt <= now));
  const depositKeys = [...new Map(studentPayments.filter((payment) => payment.status === "paid" && PART_PAYMENT_PLANS.includes(payment.paymentPlan) && payment.cohortId).map((payment) => [`${payment.cohortId}:${payment.currency}`, payment])).values()];
  const outstanding = (await Promise.all(depositKeys.map(async (payment) => {
    const detail = cohorts.find((row) => row.cohort.id === payment.cohortId);
    return detail ? { ...detail, balance: await paymentBalanceFor(user.id, detail.cohort, payment.currency) } : null;
  }))).filter((row): row is NonNullable<typeof row> => Boolean(row?.balance.remaining));

  const live = upcoming.filter(({ session }) => !session.cancelled);
  const next = live[0];
  const week = thisWeek(now);
  const classesThisWeek = allSessions.filter((s) => !s.cancelled && s.startsAt >= week.start && s.startsAt < week.end).length;
  const withState = work.map((w) => ({ ...w, state: assignmentState(w.assignment, w.submission, now) }));
  const due = withState.filter((w) => ["todo", "overdue", "resubmit"].includes(w.state));
  const graded = withState.filter((w) => w.submission?.status === "graded").sort((a, b) => +new Date(b.submission!.gradedAt ?? 0) - +new Date(a.submission!.gradedAt ?? 0));
  const scores = graded.filter((g) => g.submission!.score !== null).map((g) => (g.submission!.score! / g.assignment.maxScore) * 100);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const markBySession = new Map(marks.map((m) => [m.sessionId, m.status]));

  const progress = cohorts.map(({ cohort, course, enrollment }) => {
    const sessions = allSessions.filter((s) => s.cohortId === cohort.id && !s.cancelled);
    const done = sessions.filter((s) => s.endsAt < now);
    const marked = done.filter((s) => markBySession.has(s.id));
    const attended = marked.filter((s) => ["present", "late"].includes(markBySession.get(s.id)!)).length;
    const tasks = withState.filter((w) => w.cohort.id === cohort.id);
    const submitted = tasks.filter((t) => ["submitted", "graded"].includes(t.state)).length;
    return { cohort, course, enrollment, total: sessions.length, done: done.length, attendance: marked.length ? Math.round((attended / marked.length) * 100) : null, tasks: tasks.length, submitted };
  });

  return (
    <>
      <GreetingBanner
        tone="student"
        title={`${greeting(tz, now)}, ${firstName(user.name)}!`}
        subtitle={next ? <>Your next class is <strong className="text-white">{next.session.title}</strong>, {formatSessionRange(next.session.startsAt, next.session.endsAt, tz)}.</> : cohorts.length ? "No classes scheduled right now. Check back soon." : "Welcome! Find a cohort to start learning."}
        aside={next ? (
          <div className="flex flex-col gap-3 rounded-[5px] border border-white/15 bg-white/[0.07] p-4 backdrop-blur">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-light">
              {next.session.mode === "virtual" ? <VideoIcon className="size-4" /> : <PinIcon className="size-4" />}
              {MODE_LABEL[next.session.mode]} · starts in
            </span>
            <Countdown to={new Date(next.session.startsAt).toISOString()} />
            {next.session.mode === "virtual" && next.session.meetingUrl ? (
              <a href={next.session.meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-accent hover:bg-accent-soft"><VideoIcon className="size-4" /> Joining link</a>
            ) : next.session.venue ? (
              <p className="flex max-w-[260px] items-start gap-2 text-sm text-white/80"><PinIcon className="mt-0.5 size-4 shrink-0" /> {next.session.venue}</p>
            ) : null}
          </div>
        ) : undefined}
      >
        {cohorts.length === 0 ? <BannerButton href="/courses">Browse courses</BannerButton> : <>
          <BannerButton href="/dashboard/schedule"><CalendarIcon className="size-4" /> My timetable</BannerButton>
          <BannerButton href="/dashboard/assignments" variant="ghost"><ClipboardIcon className="size-4" /> Assignments</BannerButton>
        </>}
      </GreetingBanner>

      {welcome && <Notice>Welcome aboard! Your account is ready.{cohorts.length ? " Your classes are below." : " Browse courses to join your first cohort."}</Notice>}
      {outstanding.length > 0 && <Link href="/dashboard/payments" className="flex flex-wrap items-center justify-between gap-3 rounded-[5px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 transition hover:border-amber-400 hover:bg-amber-100"><span><strong>Payment balance due.</strong> {outstanding.map((row) => `${row.course.title}: ${formatMoney(row.balance.remaining, row.balance.currency)}`).join(" · ")}</span><span className="font-semibold text-amber-900">View and pay →</span></Link>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active courses" value={activeIds.length} icon={BookIcon} tone="purple" hint={cohorts.length > activeIds.length ? `${cohorts.length - activeIds.length} completed` : undefined} />
        <StatTile label="Classes this week" value={classesThisWeek} icon={CalendarIcon} tone="cyan" href="/dashboard/schedule" />
        <StatTile label="Assignments to do" value={due.length} icon={ClipboardIcon} tone={due.some((d) => d.state === "overdue") ? "red" : "amber"} hint={due.some((d) => d.state === "overdue") ? "Some are overdue" : undefined} href="/dashboard/assignments" />
        <StatTile label="Average score" value={average === null ? "–" : `${average}%`} icon={AwardIcon} tone="green" hint={`${graded.length} graded`} />
      </div>

      <Panel title="Your XP" icon={SparkIcon}>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 flex-col items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_24px_-12px_rgba(113,52,217,.9)]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/75">Level</span>
              <span className="font-display text-2xl font-bold leading-none">{xp.level}</span>
            </span>
            <div className="flex min-w-0 grow flex-col gap-2">
              <p className="font-display text-2xl font-bold text-ink">{xp.total.toLocaleString("en-GB")} XP</p>
              <ProgressBar value={xp.total - xp.floor} max={xp.next - xp.floor} detail={`${(xp.next - xp.total).toLocaleString("en-GB")} XP to Level ${xp.level + 1}`} />
            </div>
          </div>
          {xp.recent.length ? (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {xp.recent.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-body">{item.label}</span>
                  <span className="shrink-0 font-semibold text-accent">+{item.points} XP</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Earn XP by completing lessons ({XP.lesson}), attending classes ({XP.present}), submitting assignments ({XP.submitted}+), passing quizzes ({XP.quizPassed}+) and finishing courses ({XP.completed}).</p>}
        </div>
      </Panel>

      {(nextLearning || due[0] || next) && (
        <Link href={nextLearning ? `/dashboard/cohorts/${nextLearning.cohortId}/learn/${nextLearning.lesson.id}` : due[0] ? `/dashboard/assignments/${due[0].assignment.id}` : `/dashboard/cohorts/${next!.session.cohortId}`} className="group flex items-center justify-between gap-5 rounded-[5px] border border-accent-muted/50 bg-[linear-gradient(100deg,#f4edff,#eefcff)] p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_16px_35px_-28px_rgba(113,52,217,.75)]">
          <span className="flex min-w-0 flex-col gap-1"><span className="text-xs font-bold uppercase tracking-[1.2px] text-accent">Continue learning</span><span className="truncate font-display text-lg font-bold text-ink">{nextLearning?.lesson.title ?? due[0]?.assignment.title ?? next!.session.title}</span><span className="truncate text-sm text-muted">{nextLearning ? `${nextLearning.courseModule.title} · ${nextLearning.lesson.estimatedMinutes} min` : due[0] ? `${due[0].course.title} · ${STATE_LABEL[due[0].state].label}` : `${next!.course.title} · ${formatSessionRange(next!.session.startsAt, next!.session.endsAt, tz)}`}</span></span>
          <span className="shrink-0 font-semibold text-accent transition group-hover:translate-x-1">Continue →</span>
        </Link>
      )}

      {cohorts.length > 0 && (
        <Panel title="My courses" icon={BookIcon}>
          <div className="grid gap-4 md:grid-cols-2">
            {progress.map((p) => (
              <Link key={p.cohort.id} href={`/dashboard/cohorts/${p.cohort.id}`} className="group flex flex-col gap-4 rounded-[5px] border border-edge p-5 transition hover:-translate-y-0.5 hover:border-accent-muted hover:bg-panel">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-display text-[17px] font-bold text-ink group-hover:text-accent">{p.course.title}</p>
                    <p className="text-sm text-muted">{p.cohort.name}{p.cohort.startDate ? ` · ${formatDateOnly(p.cohort.startDate)} – ${formatDateOnly(p.cohort.endDate)}` : ""}</p>
                  </div>
                  {p.enrollment.status === "completed" ? <Badge tone="accent">Completed</Badge> : <ModeBadge mode={p.cohort.deliveryMode} />}
                </div>
                <ProgressBar value={p.done + p.submitted} max={p.total + p.tasks} label="Overall progress" detail={`${p.done}/${p.total} classes · ${p.submitted}/${p.tasks} assignments`} />
                <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                  <span className="flex flex-col"><span className="text-xs text-muted">Attendance</span><span className="font-semibold text-ink">{p.attendance === null ? "–" : `${p.attendance}%`}</span></span>
                  <span className="flex flex-col"><span className="text-xs text-muted">Assignments</span><span className="font-semibold text-ink">{p.submitted}/{p.tasks} submitted</span></span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Upcoming classes" href="/dashboard/schedule" linkLabel="Timetable" icon={CalendarIcon}>
          {live.length ? (
            <ul className="flex flex-col gap-2.5">
              {live.slice(0, 5).map(({ session, course }) => {
                const d = formatDayMonth(session.startsAt, tz);
                const started = new Date(session.startsAt) <= now;
                return (
                  <li key={session.id} className="flex items-center gap-4 rounded-[5px] border border-edge p-3.5">
                    <DateChip day={d.day} month={d.month} />
                    <div className="flex min-w-0 grow flex-col gap-0.5">
                      <p className="truncate font-semibold text-ink">{session.title}</p>
                      <p className="truncate text-sm text-muted">{course.title} · {formatSessionRange(session.startsAt, session.endsAt, tz)}</p>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <ModeBadge mode={session.mode} />
                        <span className={`text-xs font-semibold ${started ? "text-emerald-700" : "text-muted"}`}><ClockIcon className="mr-1 inline size-3.5" />{started ? "Happening now" : `Starts ${untilLabel(session.startsAt, now)}`}</span>
                      </span>
                    </div>
                    {session.mode === "virtual" && session.meetingUrl && (
                      <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer" className={`hidden h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold sm:inline-flex ${started ? "bg-accent text-white hover:bg-accent-dark" : "border border-edge-strong text-ink hover:bg-page"}`}><VideoIcon className="size-4" /> Join</a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <PanelEmpty icon={CalendarIcon} action={cohorts.length ? undefined : <Link href="/courses" className="text-sm font-semibold text-accent">Browse courses →</Link>}>{cohorts.length ? "No upcoming classes yet." : "Enrol on a cohort to see your classes here."}</PanelEmpty>}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Due soon" href="/dashboard/assignments" icon={ClipboardIcon}>
            {due.length ? (
              <ul className="flex flex-col gap-2.5">
                {due.slice(0, 4).map(({ assignment, course, state }) => (
                  <li key={assignment.id}>
                    <Link href={`/dashboard/assignments/${assignment.id}`} className="flex items-start justify-between gap-3 rounded-[5px] border border-edge p-3.5 hover:border-accent-muted">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-semibold text-ink">{assignment.title}</span>
                        <span className="truncate text-sm text-muted">{course.title}</span>
                        {assignment.dueAt && <span className={`text-xs font-semibold ${state === "overdue" ? "text-red-700" : "text-muted"}`}>Due {untilLabel(assignment.dueAt, now)}</span>}
                      </span>
                      <Badge tone={STATE_LABEL[state].tone}>{STATE_LABEL[state].label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <PanelEmpty icon={ClipboardIcon}>You&apos;re all caught up.</PanelEmpty>}
          </Panel>

          <Panel title="Latest feedback" icon={MessageIcon}>
            {graded.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {graded.slice(0, 3).map(({ assignment, submission }) => {
                  const pct = submission!.score !== null ? Math.round((submission!.score! / assignment.maxScore) * 100) : 0;
                  return (
                    <li key={assignment.id}>
                      <Link href={`/dashboard/assignments/${assignment.id}`} className="flex items-center gap-4 py-3 first:pt-0">
                        <span className={`flex size-12 shrink-0 items-center justify-center rounded-full border-4 font-display text-sm font-bold ${pct >= 70 ? "border-emerald-200 text-emerald-700" : pct >= 50 ? "border-amber-200 text-amber-700" : "border-red-200 text-red-700"}`}>{pct}%</span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold text-ink">{assignment.title}</span>
                          <span className="text-sm text-muted">{submission!.score}/{assignment.maxScore} · {submission!.gradedAt ? relativeTime(submission!.gradedAt) : ""}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : <PanelEmpty icon={MessageIcon}>Feedback from your instructors will appear here.</PanelEmpty>}
          </Panel>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Announcements" icon={MegaphoneIcon}>
          {news.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {news.map(({ announcement, author }) => (
                <li key={announcement.id}>
                  <Link href={`/dashboard/cohorts/${announcement.cohortId}`} className="flex flex-col gap-1 py-3 first:pt-0">
                    <span className="font-semibold text-ink">{announcement.title}</span>
                    {announcement.body && <span className="line-clamp-2 text-sm text-muted">{announcement.body.replace(/[*_#`>]/g, "")}</span>}
                    <span className="text-xs text-muted">{author?.name ?? "Academy"} · {relativeTime(announcement.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <PanelEmpty icon={MegaphoneIcon}>No announcements yet.</PanelEmpty>}
        </Panel>
        <Panel title="Quick actions">
          <div className="grid gap-3">
            <QuickAction href="/courses" icon={BookIcon} title="Browse courses" text="Find your next cohort" tone="purple" />
            <QuickAction href="/dashboard/schedule" icon={CalendarIcon} title="Full timetable" text="Every class, link and venue" tone="cyan" />
            <QuickAction href="/dashboard/payments" icon={CardIcon} title="Payments & receipts" text="Your payment history" tone="green" />
            <QuickAction href="/account" icon={UserIcon} title="Profile & reminders" text="Photo, phone and email settings" tone="navy" />
          </div>
        </Panel>
      </div>
    </>
  );
}
