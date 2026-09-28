import "server-only";
import { and, eq, inArray, isNotNull, isNull, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, attendance, certificates, classSessions, cohorts, courses, enrollments, lessonProgress, lessons, submissions, users } from "@/db/schema";

/**
 * XP is worked out from what students have actually done (lessons, attendance, assignments,
 * completions), not stored separately. Past activity counts automatically, and corrections to
 * attendance or grades adjust XP with them.
 */
export const XP = {
  lesson: 10,
  present: 20,
  late: 10,
  submitted: 25,
  onTime: 10,
  /** For a perfect score; scaled by the grade. */
  graded: 50,
  completed: 200,
  certificate: 100,
} as const;

export type XpItem = { userId: number; cohortId: number; points: number; label: string; at: Date };

type Scope = { userIds?: number[]; cohortId?: number };

function scoped(userColumn: Parameters<typeof eq>[0], cohortColumn: Parameters<typeof eq>[0], scope: Scope): SQL[] {
  const where: SQL[] = [];
  if (scope.userIds) where.push(inArray(userColumn, scope.userIds.length ? scope.userIds : [-1]));
  if (scope.cohortId) where.push(eq(cohortColumn, scope.cohortId));
  return where;
}

async function xpItems(scope: Scope): Promise<XpItem[]> {
  const db = await getDb();
  const [lessonRows, attendanceRows, submissionRows, completionRows, certificateRows] = await Promise.all([
    db.select({ userId: enrollments.userId, cohortId: enrollments.cohortId, title: lessons.title, at: lessonProgress.completedAt })
      .from(lessonProgress)
      .innerJoin(enrollments, eq(enrollments.id, lessonProgress.enrollmentId))
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .where(and(isNotNull(lessonProgress.completedAt), ...scoped(enrollments.userId, enrollments.cohortId, scope))),
    db.select({ userId: attendance.userId, cohortId: classSessions.cohortId, title: classSessions.title, status: attendance.status, at: attendance.markedAt })
      .from(attendance)
      .innerJoin(classSessions, eq(classSessions.id, attendance.sessionId))
      .where(and(inArray(attendance.status, ["present", "late"]), ...scoped(attendance.userId, classSessions.cohortId, scope))),
    db.select({ userId: submissions.userId, cohortId: assignments.cohortId, title: assignments.title, dueAt: assignments.dueAt, maxScore: assignments.maxScore, submittedAt: submissions.submittedAt, status: submissions.status, score: submissions.score, gradedAt: submissions.gradedAt })
      .from(submissions)
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .where(and(...scoped(submissions.userId, assignments.cohortId, scope))),
    db.select({ userId: enrollments.userId, cohortId: enrollments.cohortId, title: courses.title, kind: courses.kind, at: enrollments.completedAt, activatedAt: enrollments.activatedAt, createdAt: enrollments.createdAt })
      .from(enrollments)
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(and(eq(enrollments.status, "completed"), ...scoped(enrollments.userId, enrollments.cohortId, scope))),
    db.select({ userId: enrollments.userId, cohortId: enrollments.cohortId, title: courses.title, at: certificates.issuedAt })
      .from(certificates)
      .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .where(and(isNull(certificates.revokedAt), ...scoped(enrollments.userId, enrollments.cohortId, scope))),
  ]);

  const items: XpItem[] = [];
  for (const r of lessonRows) items.push({ userId: r.userId, cohortId: r.cohortId, points: XP.lesson, label: `Completed lesson: ${r.title}`, at: r.at! });
  for (const r of attendanceRows) items.push({ userId: r.userId, cohortId: r.cohortId, points: r.status === "present" ? XP.present : XP.late, label: `${r.status === "present" ? "Attended" : "Attended (late)"}: ${r.title}`, at: r.at });
  for (const r of submissionRows) {
    const onTime = r.dueAt ? r.submittedAt <= r.dueAt : false;
    items.push({ userId: r.userId, cohortId: r.cohortId, points: XP.submitted + (onTime ? XP.onTime : 0), label: `Submitted${onTime ? " on time" : ""}: ${r.title}`, at: r.submittedAt });
    if (r.status === "graded" && r.score !== null && r.maxScore > 0) {
      const points = Math.round(Math.min(1, Math.max(0, r.score / r.maxScore)) * XP.graded);
      if (points > 0) items.push({ userId: r.userId, cohortId: r.cohortId, points, label: `Graded ${r.score}/${r.maxScore}: ${r.title}`, at: r.gradedAt ?? r.submittedAt });
    }
  }
  for (const r of completionRows) items.push({ userId: r.userId, cohortId: r.cohortId, points: XP.completed, label: `Completed ${r.kind === "internship" ? "internship" : "course"}: ${r.title}`, at: r.at ?? r.activatedAt ?? r.createdAt });
  for (const r of certificateRows) items.push({ userId: r.userId, cohortId: r.cohortId, points: XP.certificate, label: `Earned certificate: ${r.title}`, at: r.at });
  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** XP needed to reach a level: Level 2 at 100, then each level needs 50 more than the last (250, 450, 700…). */
export function levelThreshold(level: number): number {
  const n = Math.max(0, level - 1);
  return 100 * n + 25 * n * (n - 1);
}

export type Level = { level: number; total: number; floor: number; next: number; percent: number };

export function levelFor(total: number): Level {
  let level = 1;
  while (levelThreshold(level + 1) <= total) level++;
  const floor = levelThreshold(level);
  const next = levelThreshold(level + 1);
  return { level, total, floor, next, percent: Math.round(((total - floor) / (next - floor)) * 100) };
}

/** A student's total XP, level and most recent XP activity. */
export async function xpForUser(userId: number, recent = 6): Promise<Level & { recent: XpItem[] }> {
  const items = await xpItems({ userIds: [userId] });
  return { ...levelFor(items.reduce((sum, item) => sum + item.points, 0)), recent: items.slice(0, recent) };
}

export type LeaderboardRow = { userId: number; name: string; avatarUrl: string | null; points: number; rank: number };

/** Students on a cohort ranked by the XP they earned in it. Names are shortened to first name and initial. */
export async function cohortLeaderboard(cohortId: number): Promise<LeaderboardRow[]> {
  const db = await getDb();
  const [roster, items] = await Promise.all([
    db.select({ userId: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .where(and(eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["active", "completed"]))),
    xpItems({ cohortId }),
  ]);
  const points = new Map<number, number>();
  for (const item of items) points.set(item.userId, (points.get(item.userId) ?? 0) + item.points);
  const sorted = roster
    .map((r) => {
      const [first, ...rest] = r.name.trim().split(/\s+/);
      return { userId: r.userId, name: rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first, avatarUrl: r.avatarUrl, points: points.get(r.userId) ?? 0 };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  // Equal points share a rank.
  return sorted.map((row) => ({ ...row, rank: sorted.findIndex((other) => other.points === row.points) + 1 }));
}
