import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, notifications, submissions, type User } from "@/db/schema";
import { getTeachingCohortIds } from "./data";

export async function unreadCount(userId: number): Promise<number> {
  const [row] = await (await getDb()).select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

/** Submissions waiting for review in cohorts this user teaches. */
export async function toGradeCount(user: User): Promise<number> {
  if (user.role === "student") return 0;
  const cohortIds = await getTeachingCohortIds(user);
  if (!cohortIds.length) return 0;
  const [row] = await (await getDb())
    .select({ n: count() })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(and(inArray(assignments.cohortId, cohortIds), eq(submissions.status, "submitted")));
  return row?.n ?? 0;
}

export async function latestNotifications(userId: number, limit = 6) {
  return (await getDb()).select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}
