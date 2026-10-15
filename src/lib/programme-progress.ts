import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { certificates, cohorts, courseModules, enrollments, lessonProgress, lessons, programmeCertificates, programmeEnrollments, programmes, users, type Course } from "@/db/schema";
import { sendEmail } from "./email";
import { notify } from "./notify";
import { programmeName } from "./programme-pricing";
import { programmeCourseMap } from "./programmes";
import { absoluteUrl } from "./site";
import { firstName } from "./utils";

export type CourseStep = {
  course: Course;
  /** Their place on the course: a completed one if they have it, otherwise a current one. */
  place: { enrollmentId: number; cohortId: number; cohortName: string; startDate: string | null; completed: boolean } | null;
  /** Holds a valid certificate for the course (or completed one that doesn't issue certificates). */
  done: boolean;
  /** Share of the course's published lessons they've completed, 0–100. */
  lessons: number;
};

export type ProgrammeProgress = {
  steps: CourseStep[];
  completed: number;
  /** Across the whole programme: finished courses count in full, the rest by lessons done. */
  percent: number;
  /** The course to carry on with: the first booked course that isn't finished. */
  current: CourseStep | null;
};

/** Where a student is on each of the given programmes, course by course. Courses finished outside the programme count too. */
export async function programmeProgress(userId: number, programmeIds: number[]): Promise<Map<number, ProgrammeProgress>> {
  const out = new Map<number, ProgrammeProgress>();
  const included = await programmeCourseMap(programmeIds);
  const courseIds = [...new Set([...included.values()].flat().map((c) => c.id))];
  if (!courseIds.length) return out;
  const db = await getDb();
  const places = await db.select({ enrollment: enrollments, cohort: cohorts }).from(enrollments).innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .where(and(eq(enrollments.userId, userId), inArray(cohorts.courseId, courseIds), inArray(enrollments.status, ["active", "completed"])));
  const enrollmentIds = places.map((p) => p.enrollment.id);
  const [valid, totals, done] = await Promise.all([
    enrollmentIds.length ? db.select({ enrollmentId: certificates.enrollmentId }).from(certificates).where(and(inArray(certificates.enrollmentId, enrollmentIds), isNull(certificates.revokedAt))) : [],
    db.select({ courseId: courseModules.courseId, n: count() }).from(lessons).innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .where(and(inArray(courseModules.courseId, courseIds), eq(courseModules.published, true), eq(lessons.published, true))).groupBy(courseModules.courseId),
    enrollmentIds.length ? db.select({ enrollmentId: lessonProgress.enrollmentId, n: count() }).from(lessonProgress).innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId)).innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .where(and(inArray(lessonProgress.enrollmentId, enrollmentIds), eq(lessons.published, true), eq(courseModules.published, true), sql`${lessonProgress.completedAt} is not null`)).groupBy(lessonProgress.enrollmentId) : [],
  ]);
  const certified = new Set(valid.map((v) => v.enrollmentId));

  for (const [programmeId, list] of included) {
    const steps: CourseStep[] = list.map((course) => {
      const own = places.filter((p) => p.cohort.courseId === course.id);
      const pick = own.find((p) => p.enrollment.status === "completed") ?? own[0];
      const completed = pick?.enrollment.status === "completed";
      const total = totals.find((t) => t.courseId === course.id)?.n ?? 0;
      const finished = pick ? done.find((d) => d.enrollmentId === pick.enrollment.id)?.n ?? 0 : 0;
      return {
        course,
        place: pick ? { enrollmentId: pick.enrollment.id, cohortId: pick.cohort.id, cohortName: pick.cohort.name, startDate: pick.cohort.startDate, completed } : null,
        done: completed && (!course.certificateEnabled || certified.has(pick.enrollment.id)),
        lessons: completed ? 100 : total ? Math.min(100, Math.round((finished / total) * 100)) : 0,
      };
    });
    const percent = steps.length ? Math.round(steps.reduce((sum, s) => sum + (s.done ? 100 : Math.min(s.lessons, 95)), 0) / steps.length) : 0;
    out.set(programmeId, { steps, completed: steps.filter((s) => s.done).length, percent, current: steps.find((s) => s.place && !s.place.completed) ?? null });
  }
  return out;
}

/**
 * Brings a student's programme certificates in line with their progress: issues one (and emails it) when every
 * course is done on a programme they're on, and revokes it when that stops being true (a course certificate
 * withdrawn, or the programme cancelled). Safe to call after any change.
 */
export async function syncProgrammeCertificates(userId: number): Promise<void> {
  const db = await getDb();
  const [mine, held] = await Promise.all([
    db.select({ programmeId: programmeEnrollments.programmeId, status: programmeEnrollments.status }).from(programmeEnrollments).where(eq(programmeEnrollments.userId, userId)),
    db.select().from(programmeCertificates).where(eq(programmeCertificates.userId, userId)),
  ]);
  const active = mine.filter((m) => m.status === "active").map((m) => m.programmeId);
  const progress = await programmeProgress(userId, active);
  for (const programmeId of new Set([...active, ...held.map((h) => h.programmeId)])) {
    const p = progress.get(programmeId);
    const earned = Boolean(p && p.steps.length >= 2 && p.completed === p.steps.length);
    const cert = held.find((h) => h.programmeId === programmeId);
    if (earned && (!cert || cert.revokedAt)) {
      const code = cert?.code ?? `TSP-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
      await db.insert(programmeCertificates).values({ userId, programmeId, code }).onConflictDoUpdate({ target: [programmeCertificates.userId, programmeCertificates.programmeId], set: { revokedAt: null, issuedAt: new Date() } });
      const [[student], [programme]] = await Promise.all([db.select().from(users).where(eq(users.id, userId)), db.select({ title: programmes.title }).from(programmes).where(eq(programmes.id, programmeId))]);
      if (student && programme) {
        const url = absoluteUrl(`/certificates/${code}`);
        await sendEmail(student.email, "certificate_issued", { name: firstName(student.name), courseTitle: programmeName(programme.title), certificateCode: code, certificateUrl: url });
        await notify([userId], { kind: "enrollment", title: `You've completed the ${programmeName(programme.title)}`, body: "Your programme certificate is ready.", href: "/dashboard/certificates" });
      }
    } else if (!earned && cert && !cert.revokedAt) {
      await db.update(programmeCertificates).set({ revokedAt: new Date() }).where(eq(programmeCertificates.id, cert.id));
    }
  }
}
