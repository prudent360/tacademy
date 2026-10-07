import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import { cohortInstructors, cohorts, courses, enrollments, jobApplications, jobOpenings, payments, users } from "@/db/schema";
import { can, getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { parseStudentId, studentId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export type SearchHit = { group: string; title: string; detail: string; href: string; kind: "person" | "course" | "cohort" | "payment" | "job" | "application" };

const LIMIT = 6;

/**
 * Live results for the command palette (⌘K). Only what this person may see: admins and team members by
 * permission, instructors their own cohorts and students, students their own courses and the catalogue.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ hits: [] }, { status: 401 });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ hits: [] });
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const db = await getDb();
  const hits: SearchHit[] = [];
  const staff = user.role === "admin" || user.role === "staff";

  if (staff) {
    const [people, manageCourses, viewPayments, careers] = await Promise.all([can(user, "users.view"), can(user, "courses.manage"), can(user, "payments.view"), can(user, "careers.manage")]);
    const tasks: Promise<void>[] = [];
    if (people) tasks.push((async () => {
      const id = parseStudentId(q);
      const rows = await db.select().from(users).where(id ? eq(users.id, id) : or(ilike(users.name, like), ilike(users.email, like), ilike(users.phone, like))).orderBy(desc(users.createdAt)).limit(LIMIT);
      for (const u of rows) hits.push({ group: "People", kind: "person", title: u.name, detail: [u.role === "student" ? studentId(u) : u.role, u.email].join(" · "), href: `/admin/users/${u.id}` });
    })());
    if (manageCourses) tasks.push((async () => {
      const [courseRows, cohortRows] = await Promise.all([
        db.select().from(courses).where(or(ilike(courses.title, like), ilike(courses.category, like), ilike(courses.slug, like))).limit(LIMIT),
        db.select({ cohort: cohorts, course: courses }).from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(or(ilike(cohorts.name, like), ilike(courses.title, like))).orderBy(desc(cohorts.startDate)).limit(LIMIT),
      ]);
      for (const c of courseRows) hits.push({ group: "Courses", kind: "course", title: c.title, detail: [c.kind === "internship" ? "Internship" : "Course", c.category, c.published ? "Published" : "Draft"].filter(Boolean).join(" · "), href: `/admin/courses/${c.id}` });
      for (const { cohort, course } of cohortRows) hits.push({ group: "Cohorts", kind: "cohort", title: `${course.title}: ${cohort.name}`, detail: cohort.startDate ? `Starts ${cohort.startDate}` : "Dates to be confirmed", href: `/teach/cohorts/${cohort.id}` });
    })());
    if (viewPayments) tasks.push((async () => {
      const rows = await db.select({ p: payments, name: users.name, email: users.email }).from(payments).innerJoin(users, eq(users.id, payments.userId))
        .where(or(ilike(payments.reference, like), ilike(users.email, like), ilike(users.name, like))).orderBy(desc(payments.createdAt)).limit(LIMIT);
      for (const { p, name } of rows) hits.push({ group: "Payments", kind: "payment", title: `${formatMoney(p.amount, p.currency)} · ${name}`, detail: `${p.reference} · ${p.status}`, href: `/admin/payments?q=${encodeURIComponent(p.reference)}` });
    })());
    if (careers) tasks.push((async () => {
      const [jobs, apps] = await Promise.all([
        db.select().from(jobOpenings).where(or(ilike(jobOpenings.title, like), ilike(jobOpenings.department, like))).limit(LIMIT),
        db.select().from(jobApplications).where(or(ilike(jobApplications.name, like), ilike(jobApplications.email, like))).orderBy(desc(jobApplications.createdAt)).limit(LIMIT),
      ]);
      for (const j of jobs) hits.push({ group: "Careers", kind: "job", title: j.title, detail: [j.department, j.status].filter(Boolean).join(" · "), href: `/admin/careers/${j.id}` });
      for (const a of apps) hits.push({ group: "Careers", kind: "application", title: a.name, detail: `Applied for ${a.jobTitle}`, href: `/admin/careers/applications/${a.id}` });
    })());
    await Promise.all(tasks);
  } else if (user.role === "instructor") {
    const mine = await db.select({ cohort: cohorts, course: courses }).from(cohortInstructors).innerJoin(cohorts, eq(cohorts.id, cohortInstructors.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(eq(cohortInstructors.userId, user.id));
    const ql = q.toLowerCase();
    for (const { cohort, course } of mine.filter(({ cohort, course }) => `${course.title} ${cohort.name}`.toLowerCase().includes(ql)).slice(0, LIMIT)) {
      hits.push({ group: "My cohorts", kind: "cohort", title: `${course.title}: ${cohort.name}`, detail: cohort.startDate ? `Starts ${cohort.startDate}` : "Dates to be confirmed", href: `/teach/cohorts/${cohort.id}` });
    }
    const ids = mine.map((m) => m.cohort.id);
    if (ids.length) {
      const students = await db.select({ u: users, cohortId: enrollments.cohortId }).from(enrollments).innerJoin(users, eq(users.id, enrollments.userId))
        .where(and(inArray(enrollments.cohortId, ids), or(ilike(users.name, like), ilike(users.email, like)))).limit(LIMIT);
      for (const { u, cohortId } of students) {
        const c = mine.find((m) => m.cohort.id === cohortId);
        hits.push({ group: "Students", kind: "person", title: u.name, detail: c ? `${c.course.title}: ${c.cohort.name}` : u.email, href: `/teach/cohorts/${cohortId}` });
      }
    }
  } else {
    const [mine, catalogue] = await Promise.all([
      db.select({ cohort: cohorts, course: courses }).from(enrollments).innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId))
        .where(and(eq(enrollments.userId, user.id), inArray(enrollments.status, ["active", "completed"]), or(ilike(courses.title, like), ilike(cohorts.name, like)))).limit(LIMIT),
      db.select().from(courses).where(and(eq(courses.published, true), or(ilike(courses.title, like), ilike(courses.category, like)))).limit(LIMIT),
    ]);
    for (const { cohort, course } of mine) hits.push({ group: "My courses", kind: "cohort", title: course.title, detail: cohort.name, href: `/dashboard/cohorts/${cohort.id}` });
    for (const c of catalogue) hits.push({ group: "Explore courses", kind: "course", title: c.title, detail: c.kind === "internship" ? "Internship" : c.category || "Course", href: `/courses/${c.slug}` });
  }
  return Response.json({ hits });
}
