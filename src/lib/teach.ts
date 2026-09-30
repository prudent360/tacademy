import "server-only";
import { and, asc, count, desc, eq, exists, gte, inArray, lt, notExists } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, attendance, classSessions, cohorts, courses, enrollments, submissions, users } from "@/db/schema";

export async function cohortsWithStats(cohortIds: number[]) {
  if (!cohortIds.length) return [];
  const db = await getDb();
  const rows = await db.select({ cohort: cohorts, course: courses }).from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(inArray(cohorts.id, cohortIds)).orderBy(desc(cohorts.startDate));
  const students = await db.select({ cohortId: enrollments.cohortId, n: count() }).from(enrollments).where(and(inArray(enrollments.cohortId, cohortIds), inArray(enrollments.status, ["active", "completed"]))).groupBy(enrollments.cohortId);
  const toGrade = await db.select({ cohortId: assignments.cohortId, n: count() }).from(submissions).innerJoin(assignments, eq(assignments.id, submissions.assignmentId)).where(and(inArray(assignments.cohortId, cohortIds), eq(submissions.status, "submitted"))).groupBy(assignments.cohortId);
  const next = await db.select().from(classSessions).where(and(inArray(classSessions.cohortId, cohortIds), gte(classSessions.startsAt, new Date()), eq(classSessions.cancelled, false))).orderBy(asc(classSessions.startsAt));
  return rows.map((r) => ({
    ...r,
    students: students.find((s) => s.cohortId === r.cohort.id)?.n ?? 0,
    toGrade: toGrade.find((s) => s.cohortId === r.cohort.id)?.n ?? 0,
    nextSession: next.find((s) => s.cohortId === r.cohort.id) ?? null,
  }));
}

export async function gradingQueue(cohortIds: number[]) {
  if (!cohortIds.length) return [];
  return (await getDb())
    .select({ submission: submissions, assignment: assignments, student: { id: users.id, name: users.name }, course: courses, cohort: cohorts })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .innerJoin(users, eq(users.id, submissions.userId))
    .innerJoin(cohorts, eq(cohorts.id, assignments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(inArray(assignments.cohortId, cohortIds), eq(submissions.status, "submitted")))
    .orderBy(asc(submissions.submittedAt));
}

/** Live classes that have ended with no attendance taken, oldest first. Classes in cohorts with no active students are skipped. */
export async function attendanceToDo(cohortIds: number[]) {
  if (!cohortIds.length) return [];
  const db = await getDb();
  return db
    .select({ session: classSessions, course: { id: courses.id, title: courses.title }, cohortName: cohorts.name })
    .from(classSessions)
    .innerJoin(cohorts, eq(cohorts.id, classSessions.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(
      inArray(classSessions.cohortId, cohortIds),
      eq(classSessions.cancelled, false),
      lt(classSessions.endsAt, new Date()),
      notExists(db.select({ id: attendance.sessionId }).from(attendance).where(eq(attendance.sessionId, classSessions.id))),
      exists(db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.cohortId, classSessions.cohortId), eq(enrollments.status, "active")))),
    ))
    .orderBy(asc(classSessions.startsAt));
}
