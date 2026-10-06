import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { certificates, cohorts, courses, enrollments, showcaseProjects, users } from "@/db/schema";

/** Published projects with the student's name and course, newest first. */
export async function publishedProjects(options: { courseSlug?: string; limit?: number } = {}) {
  const db = await getDb();
  const where = and(eq(showcaseProjects.status, "published"), ...(options.courseSlug ? [eq(courses.slug, options.courseSlug)] : []));
  const query = db
    .select({ project: showcaseProjects, studentName: users.name, courseTitle: courses.title, courseSlug: courses.slug })
    .from(showcaseProjects)
    .innerJoin(users, eq(users.id, showcaseProjects.userId))
    .leftJoin(courses, eq(courses.id, showcaseProjects.courseId))
    .where(where)
    .orderBy(desc(showcaseProjects.publishedAt));
  return options.limit ? query.limit(options.limit) : query;
}

/** The student's valid certificate code for a course, if they have one, so the project can link to it. */
export async function certificateCodeFor(userId: number, courseId: number | null): Promise<string | null> {
  if (!courseId) return null;
  const db = await getDb();
  const cohortIds = (await db.select({ id: cohorts.id }).from(cohorts).where(eq(cohorts.courseId, courseId))).map((c) => c.id);
  if (!cohortIds.length) return null;
  const [row] = await db.select({ code: certificates.code }).from(certificates).innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId)).where(and(eq(enrollments.userId, userId), inArray(enrollments.cohortId, cohortIds), isNull(certificates.revokedAt))).limit(1);
  return row?.code ?? null;
}
