import type { Metadata } from "next";
import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { AlertIcon, AwardIcon, ChartIcon, UsersIcon } from "@/components/icons";
import { StatTile } from "@/components/portal/dash";
import { DataTable, EmptyState, PageHeader, PersonCell } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courses, enrollments, users } from "@/db/schema";
import { certificateEligibility } from "@/lib/certificates";

export const metadata: Metadata = { title: "Learning insights" };

export default async function InsightsPage() {
  const db = await getDb();
  const active = await db.select({ enrollment: enrollments, user: users, cohort: cohorts, course: courses }).from(enrollments).innerJoin(users, eq(users.id, enrollments.userId)).innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(inArray(enrollments.status, ["active", "completed"]));
  const rows = await Promise.all(active.map(async (row) => ({ ...row, eligibility: await certificateEligibility(row.enrollment.id) })));
  const atRisk = rows.filter((row) => row.enrollment.status === "active" && row.eligibility && (row.eligibility.attendance < 70 || row.eligibility.assignments < 60 || row.eligibility.averageScore < 50));
  const ready = rows.filter((row) => row.eligibility?.eligible).length;
  const averageProgress = rows.length ? Math.round(rows.reduce((sum, row) => sum + ((row.eligibility?.attendance ?? 0) + (row.eligibility?.assignments ?? 0)) / 2, 0) / rows.length) : 0;
  return <>
    <PageHeader title="Learning insights" description="A practical view of engagement, certificate readiness, and learners who may need an intervention." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatTile label="Learners tracked" value={rows.length} icon={UsersIcon} tone="purple" /><StatTile label="At risk" value={atRisk.length} icon={AlertIcon} tone="red" /><StatTile label="Certificate ready" value={ready} icon={AwardIcon} tone="green" /><StatTile label="Average engagement" value={`${averageProgress}%`} icon={ChartIcon} tone="cyan" /></div>
    {atRisk.length ? <DataTable><thead><tr><th>Learner</th><th>Course</th><th>Attendance</th><th>Assignments</th><th>Average score</th><th>Recommended action</th></tr></thead><tbody>{atRisk.map((row) => <tr key={row.enrollment.id}><td><PersonCell name={row.user.name} email={row.user.email} href={`/admin/users/${row.user.id}`} /></td><td><Link className="font-semibold text-ink hover:text-accent" href={`/teach/cohorts/${row.cohort.id}`}>{row.course.title}<span className="block text-xs font-normal text-muted">{row.cohort.name}</span></Link></td><td className={row.eligibility!.attendance < 70 ? "font-bold text-red-700" : ""}>{row.eligibility!.attendance}%</td><td className={row.eligibility!.assignments < 60 ? "font-bold text-red-700" : ""}>{row.eligibility!.assignments}%</td><td className={row.eligibility!.averageScore < 50 ? "font-bold text-red-700" : ""}>{row.eligibility!.averageScore}%</td><td className="text-sm text-muted"><span className="block">{row.eligibility!.attendance < 70 ? "Check attendance and contact learner" : row.eligibility!.assignments < 60 ? "Follow up on missing work" : "Offer academic support"}</span><a href={`mailto:${row.user.email}?subject=${encodeURIComponent(`Checking in: ${row.course.title}`)}`} className="mt-1 inline-block font-semibold text-accent hover:text-accent-dark">Email learner →</a></td></tr>)}</tbody></DataTable> : <EmptyState title="No learners currently at risk" icon={ChartIcon}>Attendance, assignment completion and scores are within the healthy range.</EmptyState>}
  </>;
}
