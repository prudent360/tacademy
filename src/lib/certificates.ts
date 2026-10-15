import "server-only";
import { and, eq, isNull, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, attendance, certificates, classSessions, cohorts, courses, enrollments, programmeCertificates, programmes, submissions, users, type User } from "@/db/schema";
import { programmeName } from "./programme-pricing";
import { formatDateOnly } from "./time";
import { programmeCourseMap } from "./programmes";
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

/** A valid (not revoked) certificate with its student, course and cohort, by its public code. */
export async function certificateByCode(code: string) {
  const [row] = await (await getDb())
    .select({ certificate: certificates, student: users, course: courses, cohort: cohorts })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .innerJoin(users, eq(users.id, enrollments.userId))
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(certificates.code, code), isNull(certificates.revokedAt)));
  return row ?? null;
}

const MODE = { virtual: "Live online", physical: "In person", hybrid: "Hybrid" } as const;

/** A valid course or programme certificate, in one shape for the verification page and its share image. */
export type VerifiedCertificate = {
  kind: "course" | "programme";
  code: string;
  issuedAt: Date;
  student: Pick<User, "id" | "name">;
  /** What was completed, e.g. "Data Analytics with Power BI" or "Data Career Programme". */
  title: string;
  /** A line under the title: the cohort and format, or the courses in the programme. */
  line: string;
  details: [string, string][];
};

export async function verifiedCertificate(code: string): Promise<VerifiedCertificate | null> {
  const course = await certificateByCode(code);
  const issued = (d: Date) => formatDateOnly(d.toISOString().slice(0, 10));
  if (course) {
    const { certificate, student, cohort } = course;
    const dates = cohort.startDate && cohort.endDate ? `${formatDateOnly(cohort.startDate)} – ${formatDateOnly(cohort.endDate)}` : "";
    return {
      kind: "course", code: certificate.code, issuedAt: certificate.issuedAt, student, title: course.course.title,
      line: [cohort.name, dates, MODE[cohort.deliveryMode], course.course.durationWeeks ? `${course.course.durationWeeks}-week programme` : ""].filter(Boolean).join(" · "),
      details: [["Issued to", student.name], ["Course", course.course.title], ["Cohort", cohort.name], ["Date issued", issued(certificate.issuedAt)], ["Certificate ID", certificate.code]],
    };
  }
  const [row] = await (await getDb()).select({ certificate: programmeCertificates, student: users, programme: programmes }).from(programmeCertificates)
    .innerJoin(users, eq(users.id, programmeCertificates.userId)).innerJoin(programmes, eq(programmes.id, programmeCertificates.programmeId))
    .where(and(eq(programmeCertificates.code, code), isNull(programmeCertificates.revokedAt)));
  if (!row) return null;
  const list = (await programmeCourseMap([row.programme.id])).get(row.programme.id) ?? [];
  return {
    kind: "programme", code: row.certificate.code, issuedAt: row.certificate.issuedAt, student: row.student, title: programmeName(row.programme.title),
    line: `${list.length} courses: ${list.map((c) => c.title).join(" · ")}`,
    details: [["Issued to", row.student.name], ["Programme", row.programme.title], ["Courses completed", String(list.length)], ["Date issued", issued(row.certificate.issuedAt)], ["Certificate ID", row.certificate.code]],
  };
}
