import "server-only";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments, classSessions, cohorts, courses, enrollments, submissions } from "@/db/schema";
import { reminderConfig } from "./config";
import { getSettings } from "./data";
import { notify } from "./notify";
import { absoluteUrl } from "./site";
import { formatDateTime, formatSessionRange } from "./time";
import { MODE_LABEL } from "./utils";

const HOUR = 60 * 60 * 1000;

async function activeStudentIds(cohortId: number): Promise<number[]> {
  const rows = await (await getDb())
    .select({ userId: enrollments.userId })
    .from(enrollments)
    .where(and(eq(enrollments.cohortId, cohortId), eq(enrollments.status, "active")));
  return rows.map((r) => r.userId);
}

/**
 * Sends due reminders. Idempotent: each reminder is recorded on its row, so this can run
 * as often as you like (Vercel Cron daily, plus an external scheduler every 15 minutes).
 * - Day-before class reminder: class starts within 24 hours.
 * - Hour-before class reminder: class starts within 75 minutes.
 * - Assignment deadline reminder: due within 24 hours, to students who haven't submitted.
 */
export async function sendDueReminders(now = new Date()): Promise<{ dayReminders: number; hourReminders: number; assignmentReminders: number }> {
  const db = await getDb();
  const settings = await getSettings();
  const tz = settings.timezone;
  const cfg = await reminderConfig();
  const result = { dayReminders: 0, hourReminders: 0, assignmentReminders: 0 };
  // The "about to start" window has 15 minutes of slack for schedulers that run every 15 minutes.
  const hourWindow = cfg.hourLeadMinutes + 15;
  const lookAhead = cfg.dayBefore ? 24 * 60 : cfg.hourBefore ? hourWindow : 0;

  const upcoming = await db
    .select({ session: classSessions, course: courses })
    .from(classSessions)
    .innerJoin(cohorts, eq(cohorts.id, classSessions.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(classSessions.cancelled, false), gt(classSessions.startsAt, now), lte(classSessions.startsAt, new Date(now.getTime() + lookAhead * 60_000))));

  for (const { session, course } of upcoming) {
    const minutesAway = (new Date(session.startsAt).getTime() - now.getTime()) / 60000;
    const kind = cfg.hourBefore && minutesAway <= hourWindow ? "hour" : "day";
    if (kind === "day" && !cfg.dayBefore) continue;
    if (kind === "hour" && session.reminderHourSentAt) continue;
    if (kind === "day" && (session.reminderDaySentAt || session.reminderHourSentAt)) continue;

    // Claim the reminder first so overlapping runs don't send it twice.
    const column = kind === "hour" ? classSessions.reminderHourSentAt : classSessions.reminderDaySentAt;
    const claimed = await db
      .update(classSessions)
      .set(kind === "hour" ? { reminderHourSentAt: now, reminderDaySentAt: session.reminderDaySentAt ?? now } : { reminderDaySentAt: now })
      .where(and(eq(classSessions.id, session.id), isNull(column)))
      .returning({ id: classSessions.id });
    if (!claimed.length) continue;

    const students = await activeStudentIds(session.cohortId);
    const leadTime = kind === "hour" ? (cfg.hourLeadMinutes >= 90 ? `starting in about ${Math.round(cfg.hourLeadMinutes / 60)} hours` : cfg.hourLeadMinutes >= 45 ? "starting in about an hour" : `starting in ${cfg.hourLeadMinutes} minutes`) : minutesAway >= 12 * 60 ? "tomorrow" : "later today";
    const when = formatSessionRange(session.startsAt, session.endsAt, tz);
    const location = session.mode === "virtual"
      ? (session.meetingUrl ? `**Join link:** ${session.meetingUrl}` : "The joining link will be in your dashboard.")
      : `**Venue:** ${session.venue || "See your dashboard"}`;
    await notify(students, {
      kind: "reminder",
      title: `${session.title} is ${leadTime}`,
      body: `${when} · ${MODE_LABEL[session.mode]}`,
      href: `/dashboard/cohorts/${session.cohortId}`,
      email: {
        template: "session_reminder",
        isReminder: true,
        vars: { sessionTitle: session.title, courseTitle: course.title, when, leadTime, modeLabel: MODE_LABEL[session.mode], location, sessionUrl: absoluteUrl(`/dashboard/cohorts/${session.cohortId}`) },
      },
    });
    result[kind === "hour" ? "hourReminders" : "dayReminders"] += students.length;
  }

  if (!cfg.assignmentDue) return result;
  const due = await db
    .select({ assignment: assignments, course: courses })
    .from(assignments)
    .innerJoin(cohorts, eq(cohorts.id, assignments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .where(and(eq(assignments.published, true), isNull(assignments.reminderSentAt), gt(assignments.dueAt, now), lte(assignments.dueAt, new Date(now.getTime() + cfg.assignmentLeadHours * HOUR))));

  for (const { assignment, course } of due) {
    const claimed = await db.update(assignments).set({ reminderSentAt: now }).where(and(eq(assignments.id, assignment.id), isNull(assignments.reminderSentAt))).returning({ id: assignments.id });
    if (!claimed.length) continue;
    const students = await activeStudentIds(assignment.cohortId);
    const submitted = students.length
      ? (await db.select({ userId: submissions.userId }).from(submissions).where(and(eq(submissions.assignmentId, assignment.id), inArray(submissions.userId, students)))).map((r) => r.userId)
      : [];
    const pending = students.filter((id) => !submitted.includes(id));
    const dueDate = formatDateTime(assignment.dueAt!, tz);
    await notify(pending, {
      kind: "assignment_due",
      title: `${assignment.title} is due soon`,
      body: `Due ${dueDate}`,
      href: `/dashboard/assignments/${assignment.id}`,
      email: { template: "assignment_due", isReminder: true, vars: { assignmentTitle: assignment.title, courseTitle: course.title, dueDate, assignmentUrl: absoluteUrl(`/dashboard/assignments/${assignment.id}`) } },
    });
    result.assignmentReminders += pending.length;
  }
  return result;
}
