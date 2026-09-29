import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { cache } from "react";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { cohortInstructors, cohorts, courses, enrollments, internshipCourses, settings, users, type Cohort, type Course, type Settings, type User } from "@/db/schema";

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  siteName: "Academy",
  tagline: "",
  heroEyebrow: "",
  heroTitle: "",
  heroSubtitle: "",
  logoUrl: null,
  heroImageUrl: null,
  supportEmail: "",
  phone: "",
  address: "",
  timezone: "Europe/London",
  currencies: ["GBP"],
  stats: [],
  faqs: [],
  testimonials: [],
  payment: {},
  email: {},
  reminders: {},
  ai: {},
  seo: {},
  video: {},
  updatedAt: new Date(0),
};

export const getSettings = cache(async (): Promise<Settings> => {
  const [row] = await (await getDb()).select().from(settings).where(eq(settings.id, 1));
  return row ?? DEFAULT_SETTINGS;
});

export async function getPublishedCourses(): Promise<Course[]> {
  return (await getDb()).select().from(courses).where(eq(courses.published, true)).orderBy(desc(courses.featured), asc(courses.sortOrder), asc(courses.title));
}

export async function getCourseBySlug(slug: string, { publishedOnly = true } = {}): Promise<Course | null> {
  const [course] = await (await getDb())
    .select()
    .from(courses)
    .where(publishedOnly ? and(eq(courses.slug, slug), eq(courses.published, true)) : eq(courses.slug, slug));
  return course ?? null;
}

/** Cohorts that haven't finished yet (or have no end date), soonest first. */
export async function getCurrentCohorts(courseIds?: number[]): Promise<Cohort[]> {
  if (courseIds && !courseIds.length) return [];
  const today = new Date().toISOString().slice(0, 10);
  const notOver = or(isNull(cohorts.endDate), gte(cohorts.endDate, today));
  return (await getDb())
    .select()
    .from(cohorts)
    .where(courseIds ? and(notOver, inArray(cohorts.courseId, courseIds)) : notOver)
    .orderBy(asc(cohorts.startDate), asc(cohorts.id));
}

/** Upcoming open cohorts of published courses, with their course. */
export async function getUpcomingCohorts(limit = 6): Promise<{ cohort: Cohort; course: Course }[]> {
  const today = new Date().toISOString().slice(0, 10);
  return (await getDb())
    .select({ cohort: cohorts, course: courses })
    .from(cohorts)
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(courses.published, true), eq(cohorts.enrollmentOpen, true), or(isNull(cohorts.startDate), gte(cohorts.startDate, today))))
    .orderBy(asc(cohorts.startDate))
    .limit(limit);
}

/** The soonest open cohort that still has seats, with the seats left (null when unlimited). */
export const getNextIntake = cache(async (): Promise<{ cohort: Cohort; course: Course; seatsLeft: number | null } | null> => {
  const upcoming = await getUpcomingCohorts(12);
  const taken = await seatsTaken(upcoming.map((u) => u.cohort.id));
  for (const { cohort, course } of upcoming) {
    const seatsLeft = cohort.capacity ? cohort.capacity - (taken.get(cohort.id) ?? 0) : null;
    if (seatsLeft === null || seatsLeft > 0) return { cohort, course, seatsLeft };
  }
  return null;
});

/** Active and completed enrolments per cohort, for capacity checks. */
export async function seatsTaken(cohortIds: number[]): Promise<Map<number, number>> {
  if (!cohortIds.length) return new Map();
  const rows = await (await getDb())
    .select({ cohortId: enrollments.cohortId, n: count() })
    .from(enrollments)
    .where(and(inArray(enrollments.cohortId, cohortIds), inArray(enrollments.status, ["active", "completed"])))
    .groupBy(enrollments.cohortId);
  return new Map(rows.map((r) => [r.cohortId, r.n]));
}

export async function getCohortWithCourse(id: number): Promise<{ cohort: Cohort; course: Course } | null> {
  const [row] = await (await getDb()).select({ cohort: cohorts, course: courses }).from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(eq(cohorts.id, id));
  return row ?? null;
}

export async function getInstructorsByCohort(cohortIds: number[]): Promise<Map<number, Pick<User, "id" | "name" | "email" | "avatarUrl" | "bio">[]>> {
  const out = new Map<number, Pick<User, "id" | "name" | "email" | "avatarUrl" | "bio">[]>();
  if (!cohortIds.length) return out;
  const rows = await (await getDb())
    .select({ cohortId: cohortInstructors.cohortId, id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl, bio: users.bio })
    .from(cohortInstructors)
    .innerJoin(users, eq(users.id, cohortInstructors.userId))
    .where(inArray(cohortInstructors.cohortId, cohortIds))
    .orderBy(asc(users.name));
  for (const { cohortId, ...user } of rows) out.set(cohortId, [...(out.get(cohortId) ?? []), user]);
  return out;
}

/** Students with an active or completed place on a cohort. */
export async function getCohortStudents(cohortId: number): Promise<(Pick<User, "id" | "name" | "email" | "phone" | "emailReminders"> & { status: string; enrolledAt: Date })[]> {
  return (await getDb())
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, emailReminders: users.emailReminders, status: enrollments.status, enrolledAt: enrollments.createdAt })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(and(eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["active", "completed"])))
    .orderBy(asc(users.name));
}

/** A student's cohorts with course details. */
export async function getStudentCohorts(userId: number) {
  return (await getDb())
    .select({ enrollment: enrollments, cohort: cohorts, course: courses })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(enrollments.userId, userId), inArray(enrollments.status, ["active", "completed"])))
    .orderBy(desc(cohorts.startDate));
}

/** An academy graduate: completed at least one regular course (internships don't count). */
export async function isGraduate(userId: number): Promise<boolean> {
  const rows = await (await getDb())
    .select({ id: enrollments.id })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(enrollments.userId, userId), eq(enrollments.status, "completed"), eq(courses.kind, "course")))
    .limit(1);
  return rows.length > 0;
}

/** Courses linked to an internship programme. */
export async function linkedCourseIds(internshipId: number): Promise<number[]> {
  return (await (await getDb()).select({ courseId: internshipCourses.courseId }).from(internshipCourses).where(eq(internshipCourses.internshipId, internshipId))).map((r) => r.courseId);
}

/** Titles of the courses linked to each internship, for public wording ("free for graduates of …"). */
export async function linkedCourseTitles(internshipIds: number[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  if (!internshipIds.length) return out;
  const linkedCourse = alias(courses, "linked_course");
  const rows = await (await getDb()).select({ internshipId: internshipCourses.internshipId, title: linkedCourse.title }).from(internshipCourses)
    .innerJoin(linkedCourse, eq(linkedCourse.id, internshipCourses.courseId)).where(inArray(internshipCourses.internshipId, internshipIds));
  for (const row of rows) out.set(row.internshipId, [...(out.get(row.internshipId) ?? []), row.title]);
  return out;
}

/**
 * Whether someone joins an internship's "free for graduates" intakes free: they completed one of the
 * internship's linked courses, or, when none are linked, any course.
 */
export async function graduateFor(userId: number, internshipId: number): Promise<boolean> {
  const linked = await linkedCourseIds(internshipId);
  if (!linked.length) return isGraduate(userId);
  const rows = await (await getDb())
    .select({ id: enrollments.id })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .where(and(eq(enrollments.userId, userId), eq(enrollments.status, "completed"), inArray(cohorts.courseId, linked)))
    .limit(1);
  return rows.length > 0;
}

export async function isEnrolled(userId: number, cohortId: number): Promise<boolean> {
  const rows = await (await getDb())
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["active", "completed"])));
  return rows.length > 0;
}

/** Cohort ids an instructor teaches (all cohorts for admins). */
export async function getTeachingCohortIds(user: User): Promise<number[]> {
  const db = await getDb();
  if (user.role === "admin") return (await db.select({ id: cohorts.id }).from(cohorts)).map((r) => r.id);
  return (await db.select({ id: cohortInstructors.cohortId }).from(cohortInstructors).where(eq(cohortInstructors.userId, user.id))).map((r) => r.id);
}

export async function getAdmins(): Promise<User[]> {
  return (await getDb()).select().from(users).where(and(eq(users.role, "admin"), eq(users.active, true)));
}
