import "server-only";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { announcements, assignments, attendance, classSessions, cohorts, courses, submissions, users } from "@/db/schema";
import { getStudentCohorts } from "./data";

export async function studentCohortIds(userId: number): Promise<number[]> {
  return (await getStudentCohorts(userId)).map((r) => r.cohort.id);
}

export async function upcomingSessionsFor(cohortIds: number[], limit = 50) {
  if (!cohortIds.length) return [];
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return (await getDb())
    .select({ session: classSessions, course: courses })
    .from(classSessions)
    .innerJoin(cohorts, eq(cohorts.id, classSessions.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(inArray(classSessions.cohortId, cohortIds), gte(classSessions.endsAt, since)))
    .orderBy(asc(classSessions.startsAt))
    .limit(limit);
}

export async function pastSessionsFor(cohortIds: number[], limit = 50) {
  if (!cohortIds.length) return [];
  return (await getDb())
    .select({ session: classSessions, course: courses })
    .from(classSessions)
    .innerJoin(cohorts, eq(cohorts.id, classSessions.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(inArray(classSessions.cohortId, cohortIds), lt(classSessions.endsAt, new Date())))
    .orderBy(desc(classSessions.startsAt))
    .limit(limit);
}

/** Published assignments in the student's cohorts with their own submission, if any. */
export async function assignmentsForStudent(userId: number, cohortIds: number[]) {
  if (!cohortIds.length) return [];
  const db = await getDb();
  const rows = await db
    .select({ assignment: assignments, course: courses, cohort: cohorts })
    .from(assignments)
    .innerJoin(cohorts, eq(cohorts.id, assignments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(inArray(assignments.cohortId, cohortIds), eq(assignments.published, true)))
    .orderBy(asc(assignments.dueAt));
  const ids = rows.map((r) => r.assignment.id);
  const mine = ids.length ? await db.select().from(submissions).where(and(eq(submissions.userId, userId), inArray(submissions.assignmentId, ids))) : [];
  return rows.map((r) => ({ ...r, submission: mine.find((s) => s.assignmentId === r.assignment.id) ?? null }));
}

export async function attendanceFor(userId: number, sessionIds: number[]) {
  if (!sessionIds.length) return new Map<number, (typeof attendance.$inferSelect)["status"]>();
  const rows = await (await getDb()).select().from(attendance).where(and(eq(attendance.userId, userId), inArray(attendance.sessionId, sessionIds)));
  return new Map(rows.map((r) => [r.sessionId, r.status]));
}

export async function announcementsFor(cohortIds: number[], limit = 20) {
  if (!cohortIds.length) return [];
  return (await getDb())
    .select({ announcement: announcements, author: { name: users.name, avatarUrl: users.avatarUrl } })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.authorId))
    .where(inArray(announcements.cohortId, cohortIds))
    .orderBy(desc(announcements.createdAt))
    .limit(limit);
}

export type AssignmentState = "todo" | "overdue" | "submitted" | "graded" | "resubmit";

export function assignmentState(assignment: { dueAt: Date | null }, submission: { status: string } | null, now = new Date()): AssignmentState {
  if (submission) return submission.status as AssignmentState;
  return assignment.dueAt && new Date(assignment.dueAt) < now ? "overdue" : "todo";
}

export const STATE_LABEL: Record<AssignmentState, { label: string; tone: "amber" | "red" | "accent" | "green" | "cyan" | "neutral" }> = {
  todo: { label: "To do", tone: "neutral" },
  overdue: { label: "Overdue", tone: "red" },
  submitted: { label: "Awaiting feedback", tone: "amber" },
  graded: { label: "Graded", tone: "green" },
  resubmit: { label: "Changes requested", tone: "cyan" },
};
