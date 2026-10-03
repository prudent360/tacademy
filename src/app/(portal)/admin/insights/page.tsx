import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { AlertIcon, AwardIcon, BookIcon, CalendarIcon, ChartIcon, TrendIcon, UsersIcon } from "@/components/icons";
import { DonutChart, GroupedBars, LineChart } from "@/components/portal/charts";
import { BarChart, Panel, PanelEmpty, StatTile } from "@/components/portal/dash";
import { DataTable, EmptyState, PageHeader, PersonCell } from "@/components/ui";
import { getDb } from "@/db";
import { attendance, classSessions, cohorts, courses, enrollments, lessonProgress, quizAttempts, submissions, users } from "@/db/schema";
import { certificateEligibility } from "@/lib/certificates";
import { getSettings } from "@/lib/data";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Learning insights" };

const WEEKS = 12;
const DAY = 86_400_000;

/** The Monday that starts each of the last twelve weeks, oldest first. */
function weekStarts(now: Date): Date[] {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: WEEKS }, (_, i) => new Date(monday.getTime() - (WEEKS - 1 - i) * 7 * DAY));
}

export default async function InsightsPage() {
  await requirePermission("insights.view");
  const db = await getDb();
  const now = new Date();
  const weeks = weekStarts(now);
  const since = weeks[0];
  const weekOf = (date: Date) => Math.floor((date.getTime() - since.getTime()) / (7 * DAY));

  const [active, lessonsDone, quizzesTaken, workSubmitted, marks, { timezone }] = await Promise.all([
    db.select({ enrollment: enrollments, user: users, cohort: cohorts, course: courses }).from(enrollments).innerJoin(users, eq(users.id, enrollments.userId)).innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(inArray(enrollments.status, ["active", "completed"])),
    db.select({ at: lessonProgress.completedAt }).from(lessonProgress).where(and(isNotNull(lessonProgress.completedAt), gte(lessonProgress.completedAt, since))),
    db.select({ at: quizAttempts.submittedAt }).from(quizAttempts).where(and(isNotNull(quizAttempts.submittedAt), gte(quizAttempts.submittedAt, since))),
    db.select({ at: submissions.submittedAt }).from(submissions).where(gte(submissions.submittedAt, since)),
    db.select({ at: classSessions.startsAt, status: attendance.status }).from(attendance).innerJoin(classSessions, eq(classSessions.id, attendance.sessionId)).where(and(gte(classSessions.startsAt, since), lt(classSessions.endsAt, now), eq(classSessions.cancelled, false))),
    getSettings(),
  ]);
  const rows = await Promise.all(active.map(async (row) => ({ ...row, eligibility: await certificateEligibility(row.enrollment.id) })));
  const isAtRisk = (row: (typeof rows)[number]) => row.enrollment.status === "active" && row.eligibility !== null && (row.eligibility.attendance < 70 || row.eligibility.assignments < 60 || row.eligibility.averageScore < 50);
  const atRisk = rows.filter(isAtRisk);
  const ready = rows.filter((row) => row.eligibility?.eligible).length;
  const averageProgress = rows.length ? Math.round(rows.reduce((sum, row) => sum + ((row.eligibility?.attendance ?? 0) + (row.eligibility?.assignments ?? 0)) / 2, 0) / rows.length) : 0;

  // Weekly activity and attendance, oldest week first.
  const labels = weeks.map((w) => w.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: timezone }));
  const perWeek = (dates: (Date | null)[]) => {
    const counts = Array<number>(WEEKS).fill(0);
    for (const d of dates) if (d) { const i = weekOf(d); if (i >= 0 && i < WEEKS) counts[i]++; }
    return counts;
  };
  const activity = [
    { label: "Lessons completed", color: "accent" as const, values: perWeek(lessonsDone.map((r) => r.at)) },
    { label: "Quizzes taken", color: "cyan" as const, values: perWeek(quizzesTaken.map((r) => r.at)) },
    { label: "Assignments submitted", color: "amber" as const, values: perWeek(workSubmitted.map((r) => r.at)) },
  ];
  const hasActivity = activity.some((s) => s.values.some((v) => v > 0));
  const attendanceByWeek = weeks.map((_, i) => {
    const inWeek = marks.filter((m) => weekOf(m.at) === i);
    return inWeek.length ? Math.round((inWeek.filter((m) => m.status === "present" || m.status === "late").length / inWeek.length) * 100) : null;
  });
  const markedWeeks = attendanceByWeek.filter((v): v is number => v !== null);

  // Each course's averages across its learners.
  const byCourse = [...new Map(rows.map((r) => [r.course.id, r.course])).values()].map((course) => {
    const learners = rows.filter((r) => r.course.id === course.id && r.eligibility);
    const avg = (pick: (e: NonNullable<(typeof rows)[number]["eligibility"]>) => number) => learners.length ? Math.round(learners.reduce((sum, r) => sum + pick(r.eligibility!), 0) / learners.length) : 0;
    return { label: course.title, detail: `${learners.length} learner${learners.length === 1 ? "" : "s"}`, values: [avg((e) => e.attendance), avg((e) => e.assignments), avg((e) => e.averageScore)] };
  }).sort((a, b) => b.values[0] + b.values[1] + b.values[2] - (a.values[0] + a.values[1] + a.values[2]));

  const bands = [["0–49", 0, 49], ["50–59", 50, 59], ["60–69", 60, 69], ["70–79", 70, 79], ["80–89", 80, 89], ["90–100", 90, 100]] as const;
  const scoreSpread = bands.map(([label, lo, hi]) => ({ label, value: rows.filter((r) => r.eligibility && r.eligibility.averageScore >= lo && r.eligibility.averageScore <= hi).length }));

  return <>
    <PageHeader title="Learning insights" description="A practical view of engagement, certificate readiness, and learners who may need an intervention." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatTile label="Learners tracked" value={rows.length} icon={UsersIcon} tone="purple" /><StatTile label="At risk" value={atRisk.length} icon={AlertIcon} tone="red" /><StatTile label="Certificate ready" value={ready} icon={AwardIcon} tone="green" /><StatTile label="Average engagement" value={`${averageProgress}%`} icon={ChartIcon} tone="cyan" /></div>

    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
      <Panel title="Learning activity, last 12 weeks" icon={TrendIcon}>
        {hasActivity ? <LineChart labels={labels} series={activity} /> : <PanelEmpty icon={TrendIcon}>No lessons, quizzes or assignments completed in the last 12 weeks yet.</PanelEmpty>}
      </Panel>
      <Panel title="Learner health" icon={UsersIcon}>
        {rows.length ? (
          <DonutChart
            centerLabel="learners"
            parts={[
              { label: "Certificate ready", value: ready, color: "green" },
              { label: "On track", value: rows.filter((r) => !r.eligibility?.eligible && !isAtRisk(r)).length, color: "accent" },
              { label: "At risk", value: atRisk.length, color: "red" },
            ]}
          />
        ) : <PanelEmpty icon={UsersIcon}>No active learners yet.</PanelEmpty>}
      </Panel>
    </div>

    <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
      <Panel title="Attendance by week" icon={CalendarIcon}>
        {markedWeeks.length ? <>
          <p className="-mt-1 mb-2 text-sm text-muted">Share of students present or late at live classes. Average <strong className="text-ink">{Math.round(markedWeeks.reduce((a, b) => a + b, 0) / markedWeeks.length)}%</strong>.</p>
          <LineChart labels={labels} series={[{ label: "Attendance", color: "accent", values: attendanceByWeek }]} max={100} format={(v) => `${v}%`} width={460} height={240} />
        </> : <PanelEmpty icon={CalendarIcon}>No attendance has been marked in the last 12 weeks.</PanelEmpty>}
      </Panel>
      <Panel title="Score spread" icon={ChartIcon}>
        {rows.length ? <>
          <p className="-mt-1 mb-4 text-sm text-muted">Learners by average assignment score (%).</p>
          <BarChart data={scoreSpread} highlightLast={false} />
        </> : <PanelEmpty icon={ChartIcon}>Scores appear once work is graded.</PanelEmpty>}
      </Panel>
    </div>

    {byCourse.length > 0 && (
      <Panel title="Courses compared" icon={BookIcon}>
        <GroupedBars rows={byCourse} measures={[{ label: "Attendance", color: "accent" }, { label: "Assignments submitted", color: "cyan" }, { label: "Average score", color: "amber" }]} />
      </Panel>
    )}

    <h2 className="mt-2 font-display text-xl font-bold text-ink">Learners who may need help</h2>
    {atRisk.length ? <DataTable><thead><tr><th>Learner</th><th>Course</th><th>Attendance</th><th>Assignments</th><th>Average score</th><th>Recommended action</th></tr></thead><tbody>{atRisk.map((row) => <tr key={row.enrollment.id}><td><PersonCell name={row.user.name} email={row.user.email} src={row.user.avatarUrl} gender={row.user.gender} href={`/admin/users/${row.user.id}`} /></td><td><Link className="font-semibold text-ink hover:text-accent-ink" href={`/teach/cohorts/${row.cohort.id}`}>{row.course.title}<span className="block text-xs font-normal text-muted">{row.cohort.name}</span></Link></td><td className={row.eligibility!.attendance < 70 ? "font-bold text-red-700" : ""}>{row.eligibility!.attendance}%</td><td className={row.eligibility!.assignments < 60 ? "font-bold text-red-700" : ""}>{row.eligibility!.assignments}%</td><td className={row.eligibility!.averageScore < 50 ? "font-bold text-red-700" : ""}>{row.eligibility!.averageScore}%</td><td className="text-sm text-muted"><span className="block">{row.eligibility!.attendance < 70 ? "Check attendance and contact learner" : row.eligibility!.assignments < 60 ? "Follow up on missing work" : "Offer academic support"}</span><a href={`mailto:${row.user.email}?subject=${encodeURIComponent(`Checking in: ${row.course.title}`)}`} className="mt-1 inline-block font-semibold text-accent-ink hover:text-accent-ink-strong">Email learner →</a></td></tr>)}</tbody></DataTable> : <EmptyState title="No learners currently at risk" icon={ChartIcon}>Attendance, assignment completion and scores are within the healthy range.</EmptyState>}
  </>;
}
