import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, attendance, classSessions, cohorts, courses, enrollments, submissions } from "@/db/schema";
import { courseQuizAverage } from "./quiz";

export type CertificateEligibility = {
  eligible: boolean;
  attendance: number;
  assignments: number;
  averageScore: number;
  /** Average of the best score on each course quiz; null when the course has no quizzes. */
  quizScore: number | null;
  requirements: { attendance: number; assignments: number; averageScore: number; quizScore: number };
  reasons: string[];
};

export async function certificateEligibility(enrollmentId: number): Promise<CertificateEligibility | null> {
  const db = await getDb();
  const [base] = await db.select({ enrollment: enrollments, course: courses }).from(enrollments).innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(eq(enrollments.id, enrollmentId));
  if (!base) return null;
  const { enrollment, course } = base;

  const [sessions, marks, work, submitted] = await Promise.all([
    db.select({ id: classSessions.id }).from(classSessions).where(and(eq(classSessions.cohortId, enrollment.cohortId), eq(classSessions.cancelled, false), lt(classSessions.endsAt, new Date()))),
    db.select().from(attendance).innerJoin(classSessions, eq(classSessions.id, attendance.sessionId)).where(and(eq(attendance.userId, enrollment.userId), eq(classSessions.cohortId, enrollment.cohortId))),
    db.select().from(assignments).where(and(eq(assignments.cohortId, enrollment.cohortId), eq(assignments.published, true))),
    db.select().from(submissions).where(eq(submissions.userId, enrollment.userId)),
  ]);
  const sessionIds = new Set(sessions.map((s) => s.id));
  const relevantMarks = marks.filter((m) => sessionIds.has(m.attendance.sessionId));
  const attended = relevantMarks.filter((m) => ["present", "late"].includes(m.attendance.status)).length;
  const attendancePct = sessions.length ? Math.round((attended / sessions.length) * 100) : 100;
  const assignmentIds = new Set(work.map((a) => a.id));
  const relevantSubmissions = submitted.filter((s) => assignmentIds.has(s.assignmentId));
  const completed = relevantSubmissions.filter((s) => ["submitted", "graded"].includes(s.status)).length;
  const assignmentPct = work.length ? Math.round((completed / work.length) * 100) : 100;
  const scored = relevantSubmissions.filter((s) => s.status === "graded" && s.score !== null).map((s) => {
    const max = work.find((a) => a.id === s.assignmentId)?.maxScore ?? 100;
    return (s.score! / max) * 100;
  });
  const averageScore = work.length ? (scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : 0) : 100;
  const quizScore = await courseQuizAverage(enrollment.id, course.id);
  const requirements = { attendance: course.certificateMinAttendance, assignments: course.certificateMinAssignments, averageScore: course.certificateMinScore, quizScore: course.certificateMinQuizScore };
  const reasons = [attendancePct < requirements.attendance && `Attendance is ${attendancePct}% (minimum ${requirements.attendance}%).`, assignmentPct < requirements.assignments && `Assignment completion is ${assignmentPct}% (minimum ${requirements.assignments}%).`, averageScore < requirements.averageScore && `Average score is ${averageScore}% (minimum ${requirements.averageScore}%).`, requirements.quizScore > 0 && quizScore !== null && quizScore < requirements.quizScore && `Average quiz score is ${quizScore}% (minimum ${requirements.quizScore}%).`].filter(Boolean) as string[];
  return { eligible: course.certificateEnabled && reasons.length === 0, attendance: attendancePct, assignments: assignmentPct, averageScore, quizScore, requirements, reasons: course.certificateEnabled ? reasons : ["Certificates are disabled for this course."] };
}
