import "server-only";
import { and, desc, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { communityMemberships, enrollments, users, type CommunitySettings, type User } from "@/db/schema";
import { getSettings } from "./data";
import { notify } from "./notify";
import { absoluteUrl } from "./site";

export const DEFAULT_COMMUNITY: CommunitySettings = { paid: false, prices: {}, months: 12, pitch: "" };

export async function communityConfig(): Promise<CommunitySettings> {
  return { ...DEFAULT_COMMUNITY, ...((await getSettings()).community ?? {}) };
}

/** Whether the community is paid and has a price in at least one currency. A paid switch with no prices stays open. */
export function isPaidCommunity(c: CommunitySettings): boolean {
  return c.paid && Object.values(c.prices).some((v) => (v ?? 0) > 0);
}

/**
 * Why someone can (or can't) take part. open: the community is free; team: staff, admins and instructors;
 * student / graduate: an active or completed enrolment; member: a paid or granted period; none: needs to join.
 */
export type CommunityAccess =
  | { member: true; via: "open" | "team" | "student" | "graduate" }
  | { member: true; via: "member"; endsAt: Date }
  | { member: false; via: "none"; endedAt: Date | null };

export async function communityAccess(user: Pick<User, "id" | "role">): Promise<CommunityAccess> {
  if (!isPaidCommunity(await communityConfig())) return { member: true, via: "open" };
  if (user.role !== "student") return { member: true, via: "team" };
  const db = await getDb();
  const [enrolled] = await db.select({ status: enrollments.status }).from(enrollments).where(and(eq(enrollments.userId, user.id), inArray(enrollments.status, ["active", "completed"]))).orderBy(enrollments.status);
  if (enrolled) return { member: true, via: enrolled.status === "active" ? "student" : "graduate" };
  const now = new Date();
  const [current] = await db.select({ endsAt: communityMemberships.endsAt }).from(communityMemberships)
    .where(and(eq(communityMemberships.userId, user.id), isNull(communityMemberships.revokedAt), lte(communityMemberships.startsAt, now), gt(communityMemberships.endsAt, now)))
    .orderBy(desc(communityMemberships.endsAt)).limit(1);
  if (current) return { member: true, via: "member", endsAt: await membershipEnd(user.id) ?? current.endsAt };
  const [last] = await db.select({ endsAt: communityMemberships.endsAt }).from(communityMemberships).where(and(eq(communityMemberships.userId, user.id), isNull(communityMemberships.revokedAt))).orderBy(desc(communityMemberships.endsAt)).limit(1);
  return { member: false, via: "none", endedAt: last?.endsAt ?? null };
}

/** The end of the person's paid or granted access, counting renewals already bought. Null if none is running. */
export async function membershipEnd(userId: number): Promise<Date | null> {
  const [latest] = await (await getDb()).select({ endsAt: communityMemberships.endsAt }).from(communityMemberships)
    .where(and(eq(communityMemberships.userId, userId), isNull(communityMemberships.revokedAt), gt(communityMemberships.endsAt, new Date())))
    .orderBy(desc(communityMemberships.endsAt)).limit(1);
  return latest?.endsAt ?? null;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/**
 * Adds a period of access. It starts now, or when their current access ends, so renewing early never loses days.
 * A payment only ever grants once (payment_id is unique), so webhooks and the return page can race safely.
 */
export async function grantMembership(userId: number, months: number, source: { paymentId?: number; grantedById?: number }): Promise<{ endsAt: Date } | null> {
  const db = await getDb();
  const startsAt = (await membershipEnd(userId)) ?? new Date();
  const endsAt = addMonths(startsAt, months);
  const [row] = await db.insert(communityMemberships).values({ userId, paymentId: source.paymentId ?? null, grantedById: source.grantedById ?? null, startsAt, endsAt }).onConflictDoNothing().returning({ endsAt: communityMemberships.endsAt });
  return row ?? null;
}

/** After a full refund: takes away the period that payment bought. */
export async function revokeMembershipForPayment(paymentId: number): Promise<boolean> {
  const rows = await (await getDb()).update(communityMemberships).set({ revokedAt: new Date() }).where(and(eq(communityMemberships.paymentId, paymentId), isNull(communityMemberships.revokedAt))).returning({ id: communityMemberships.id });
  return rows.length > 0;
}

const DAY = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = 7;

/** Daily: emails members whose access ends within a week and who haven't renewed. Returns how many were reminded. */
export async function sendMembershipReminders(): Promise<number> {
  if (!isPaidCommunity(await communityConfig())) return 0;
  const db = await getDb();
  const now = new Date();
  const due = await db.select({ membership: communityMemberships, user: users }).from(communityMemberships).innerJoin(users, eq(users.id, communityMemberships.userId))
    .where(and(isNull(communityMemberships.revokedAt), isNull(communityMemberships.reminderSentAt), gt(communityMemberships.endsAt, now), lte(communityMemberships.endsAt, new Date(now.getTime() + REMINDER_DAYS * DAY))));
  let sent = 0;
  for (const { membership, user } of due) {
    await db.update(communityMemberships).set({ reminderSentAt: now }).where(eq(communityMemberships.id, membership.id));
    // Someone who already renewed has a later period; only the last one gets a reminder.
    const end = await membershipEnd(user.id);
    if (end && end.getTime() > membership.endsAt.getTime()) continue;
    const access = await communityAccess(user);
    if (access.via !== "member") continue;
    const endDate = membership.endsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    await notify([user.id], {
      kind: "community",
      title: `Your community membership ends on ${endDate}`,
      body: "Renew to keep posting and reading every thread.",
      href: "/community/join",
      email: { template: "community_expiring", vars: { endDate, renewUrl: absoluteUrl("/community/join") }, isReminder: true },
    });
    sent++;
  }
  return sent;
}
