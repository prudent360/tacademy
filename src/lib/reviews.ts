import "server-only";
import { and, avg, count, desc, eq, inArray, lt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { cohorts, courseReviews, courses, enrollments, users } from "@/db/schema";

export type RatingSummary = { average: number; count: number };

/** Average rating and number of published reviews per course. */
export async function ratingsFor(courseIds: number[]): Promise<Map<number, RatingSummary>> {
  if (!courseIds.length) return new Map();
  const rows = await (await getDb()).select({ courseId: courseReviews.courseId, average: avg(courseReviews.rating), n: count() })
    .from(courseReviews).where(and(inArray(courseReviews.courseId, courseIds), eq(courseReviews.status, "published"))).groupBy(courseReviews.courseId);
  return new Map(rows.map((r) => [r.courseId, { average: Math.round(Number(r.average) * 10) / 10, count: r.n }]));
}

/** Published reviews for a course page, newest first, with a short display name (first name and initial). */
export async function publishedReviews(courseId: number, limit = 12) {
  const rows = await (await getDb()).select({ review: courseReviews, name: users.name, gender: users.gender, avatarUrl: users.avatarUrl, cohortName: cohorts.name })
    .from(courseReviews)
    .innerJoin(users, eq(users.id, courseReviews.userId))
    .innerJoin(enrollments, eq(enrollments.id, courseReviews.enrollmentId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.status, "published")))
    .orderBy(desc(courseReviews.publishedAt), desc(courseReviews.id))
    .limit(limit);
  return rows.map((r) => {
    const [first, ...rest] = r.name.trim().split(/\s+/);
    return { ...r, displayName: rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first, fullName: r.name };
  });
}

/**
 * Enrolments a student can review: finished (completed, or their cohort has ended), with the review if they
 * already wrote one.
 */
export async function reviewableFor(userId: number) {
  const today = new Date().toISOString().slice(0, 10);
  return (await getDb()).select({ enrollmentId: enrollments.id, courseId: courses.id, courseTitle: courses.title, cohortName: cohorts.name, review: courseReviews })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .leftJoin(courseReviews, eq(courseReviews.enrollmentId, enrollments.id))
    .where(and(eq(enrollments.userId, userId), or(eq(enrollments.status, "completed"), and(eq(enrollments.status, "active"), lt(cohorts.endDate, today)))));
}
