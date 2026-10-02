import "server-only";
import { and, asc, count, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { cohortWaitlist, enrollments, type WaitlistEntry } from "@/db/schema";
import { getCohortWithCourse } from "./data";
import { sendEmail } from "./email";
import { absoluteUrl } from "./site";
import { formatDateOnly } from "./time";
import { firstName } from "./utils";

/** How long an offered place is held for the person it was offered to. */
export const OFFER_HOURS = 48;

/** Their place in the queue (1 = next), counting only people still waiting. */
export async function waitlistPosition(entry: Pick<WaitlistEntry, "cohortId" | "createdAt">): Promise<number> {
  const [{ n }] = await (await getDb()).select({ n: count() }).from(cohortWaitlist)
    .where(and(eq(cohortWaitlist.cohortId, entry.cohortId), eq(cohortWaitlist.status, "waiting"), lt(cohortWaitlist.createdAt, entry.createdAt)));
  return n + 1;
}

/** Emails one waiting (or chosen) person that a place is theirs to take for the next 48 hours. */
export async function sendOffer(entry: WaitlistEntry): Promise<void> {
  const found = await getCohortWithCourse(entry.cohortId);
  if (!found) return;
  await (await getDb()).update(cohortWaitlist).set({ status: "offered", offeredAt: new Date() }).where(eq(cohortWaitlist.id, entry.id));
  await sendEmail(entry.email, "waitlist_place_open", {
    name: firstName(entry.name),
    courseTitle: found.course.title,
    cohortName: found.cohort.name,
    startDate: found.cohort.startDate ? formatDateOnly(found.cohort.startDate) : "soon",
    hours: String(OFFER_HOURS),
    enrolUrl: absoluteUrl(`/enroll?cohort=${entry.cohortId}`),
  });
}

/**
 * Offers any free places on a cohort to the people at the front of its waitlist. Places already offered (and
 * not yet expired) count as taken, so the same place isn't offered twice. Safe to call any time.
 */
export async function offerOpenPlaces(cohortId: number): Promise<number> {
  const db = await getDb();
  const found = await getCohortWithCourse(cohortId);
  if (!found?.cohort.capacity || !found.cohort.enrollmentOpen) return 0;
  const since = new Date(Date.now() - OFFER_HOURS * 3_600_000);
  const [[taken], [held]] = await Promise.all([
    db.select({ n: count() }).from(enrollments).where(and(eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["active", "completed"]))),
    db.select({ n: count() }).from(cohortWaitlist).where(and(eq(cohortWaitlist.cohortId, cohortId), eq(cohortWaitlist.status, "offered"), gte(cohortWaitlist.offeredAt, since))),
  ]);
  const free = found.cohort.capacity - taken.n - held.n;
  if (free <= 0) return 0;
  const next = await db.select().from(cohortWaitlist).where(and(eq(cohortWaitlist.cohortId, cohortId), eq(cohortWaitlist.status, "waiting"))).orderBy(asc(cohortWaitlist.createdAt)).limit(free);
  for (const entry of next) await sendOffer(entry);
  return next.length;
}

/** Offers that ran out pass to the next person in line. Run by the scheduled job. */
export async function expireOffers(): Promise<number> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - OFFER_HOURS * 3_600_000);
  const expired = await db.update(cohortWaitlist).set({ status: "expired" }).where(and(eq(cohortWaitlist.status, "offered"), lt(cohortWaitlist.offeredAt, cutoff))).returning({ cohortId: cohortWaitlist.cohortId });
  for (const cohortId of new Set(expired.map((e) => e.cohortId))) await offerOpenPlaces(cohortId);
  return expired.length;
}

/** Called when someone enrols: they're off that cohort's waitlist. */
export async function markWaitlistEnrolled(cohortId: number, email: string): Promise<void> {
  await (await getDb()).update(cohortWaitlist).set({ status: "enrolled" }).where(and(eq(cohortWaitlist.cohortId, cohortId), eq(cohortWaitlist.email, email.toLowerCase()), inArray(cohortWaitlist.status, ["waiting", "offered", "expired"])));
}
