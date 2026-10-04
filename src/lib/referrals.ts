import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { cohorts, courses, referralCommissions, users, type Payment, type ReferralCommission, type ReferralSettings, type User } from "@/db/schema";
import { getSettings } from "./data";
import { formatMoney } from "./money";
import { notify } from "./notify";
import { absoluteUrl } from "./site";

export const DEFAULT_REFERRALS: ReferralSettings = { enabled: false, percent: 10, cookieDays: 30, holdDays: 14, scope: "first", terms: "" };
export const REF_COOKIE = "academy_ref";

export async function referralConfig(): Promise<ReferralSettings> {
  return { ...DEFAULT_REFERRALS, ...((await getSettings()).referrals ?? {}) };
}

/** Where a commission stands: pending (inside the refund window), ready (can be paid out), paid or cancelled. */
export type CommissionState = "pending" | "ready" | "paid" | "cancelled";
export function commissionState(c: Pick<ReferralCommission, "status" | "availableAt">, now = new Date()): CommissionState {
  if (c.status !== "pending") return c.status;
  return c.availableAt <= now ? "ready" : "pending";
}

/** The person's referral code, made on first use: their first name plus four characters, e.g. ADA7K2P. */
export async function ensureReferralCode(user: Pick<User, "id" | "name" | "referralCode">): Promise<string> {
  if (user.referralCode) return user.referralCode;
  const db = await getDb();
  const stem = (user.name.split(" ")[0] ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "TSU";
  for (let attempt = 0; attempt < 6; attempt++) {
    // No 0/O or 1/I, so codes read aloud or typed from a screenshot still work.
    const tail = Array.from(randomBytes(4), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
    const code = `${stem}${tail}`;
    const [row] = await db.update(users).set({ referralCode: code }).where(and(eq(users.id, user.id), isNull(users.referralCode))).returning({ code: users.referralCode }).catch(() => []);
    if (row?.code) return row.code;
    const [current] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, user.id));
    if (current?.code) return current.code;
  }
  throw new Error("Couldn't create a referral code.");
}

export function referralLink(code: string, to?: string): string {
  return absoluteUrl(`/r/${code}${to ? `?to=${encodeURIComponent(to)}` : ""}`);
}

/**
 * Credits a brand-new account to whoever's referral link the visitor used (the cookie set by /r/[code]).
 * Call right after creating an account; existing accounts are never re-assigned.
 */
export async function attachReferrer(userId: number): Promise<void> {
  const jar = await cookies();
  const code = jar.get(REF_COOKIE)?.value;
  if (!code) return;
  // The link has done its job (or can't apply), so stop showing "Referred by".
  jar.delete(REF_COOKIE);
  if (!(await referralConfig()).enabled) return;
  const db = await getDb();
  const [referrer] = await db.select({ id: users.id }).from(users).where(and(eq(users.referralCode, code.toUpperCase()), eq(users.active, true)));
  if (!referrer || referrer.id === userId) return;
  await db.update(users).set({ referredById: referrer.id }).where(and(eq(users.id, userId), isNull(users.referredById)));
}

/** For the "Referred by" card: who referred this visitor, from the referral cookie. Null when there's no valid referral. */
export async function visitorReferrer(): Promise<{ name: string; avatarUrl: string | null; gender: User["gender"]; code: string } | null> {
  const code = (await cookies()).get(REF_COOKIE)?.value?.toUpperCase();
  if (!code || !/^[A-Z0-9]{4,20}$/.test(code) || !(await referralConfig()).enabled) return null;
  const [referrer] = await (await getDb()).select({ name: users.name, avatarUrl: users.avatarUrl, gender: users.gender }).from(users).where(and(eq(users.referralCode, code), eq(users.active, true)));
  if (!referrer) return null;
  // First name and initial, e.g. "Ada L.": enough to recognise, without the full name.
  const [first, ...rest] = referrer.name.trim().split(/\s+/);
  return { name: `${first}${rest.length ? ` ${rest[rest.length - 1][0].toUpperCase()}.` : ""}`, avatarUrl: referrer.avatarUrl, gender: referrer.gender, code };
}

/** Records the referrer's commission on a successful payment. Safe to call more than once per payment. */
export async function recordCommission(payment: Payment): Promise<void> {
  if (!payment.cohortId || payment.amount <= 0) return;
  const cfg = await referralConfig();
  if (!cfg.enabled) return;
  const db = await getDb();
  const [student] = await db.select().from(users).where(eq(users.id, payment.userId));
  if (!student?.referredById) return;
  const [referrer] = await db.select().from(users).where(eq(users.id, student.referredById));
  if (!referrer?.active) return;
  const [found] = await db.select({ course: courses }).from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(eq(cohorts.id, payment.cohortId));
  if (!found) return;
  const { course } = found;
  if (cfg.scope === "first") {
    // Only the first programme they bought counts (its deposit and balance included).
    const [other] = await db.select({ id: referralCommissions.id }).from(referralCommissions).where(and(eq(referralCommissions.referredUserId, student.id), ne(referralCommissions.courseId, course.id)));
    if (other) return;
  }
  const percent = course.referralPercent ?? cfg.percent;
  if (!percent || percent <= 0) return;
  const amount = Math.round((payment.amount * percent) / 100);
  if (amount <= 0) return;
  const [created] = await db.insert(referralCommissions).values({
    referrerId: referrer.id,
    referredUserId: student.id,
    paymentId: payment.id,
    courseId: course.id,
    courseTitle: course.title,
    currency: payment.currency,
    paymentAmount: payment.amount,
    percent,
    amount,
    availableAt: new Date((payment.paidAt ?? new Date()).getTime() + cfg.holdDays * 86_400_000),
  }).onConflictDoNothing({ target: referralCommissions.paymentId }).returning();
  if (!created) return;
  const money = formatMoney(amount, payment.currency);
  await notify([referrer.id], {
    kind: "referral",
    title: `You earned ${money} in referral commission`,
    body: `${student.name.split(" ")[0]} joined ${course.title} through your link.`,
    href: "/account/referrals",
    email: { template: "referral_earned", vars: { amount: money, friend: student.name.split(" ")[0], courseTitle: course.title, holdDays: String(cfg.holdDays), referralsUrl: absoluteUrl("/account/referrals") } },
  });
}

/** After a refund: a commission not yet paid out shrinks with it, or is cancelled when the refund is full. */
export async function adjustCommissionForRefund(payment: Payment): Promise<void> {
  const db = await getDb();
  const [commission] = await db.select().from(referralCommissions).where(eq(referralCommissions.paymentId, payment.id));
  if (!commission) return;
  const kept = Math.max(0, payment.amount - payment.refundedAmount);
  if (commission.status === "paid") {
    await db.update(referralCommissions).set({ note: sql`trim(${referralCommissions.note} || ' Payment refunded after this commission was paid out.')` }).where(eq(referralCommissions.id, commission.id));
    return;
  }
  if (commission.status !== "pending") return;
  const amount = Math.round((kept * commission.percent) / 100);
  await db.update(referralCommissions)
    // A full refund keeps the original figure, shown crossed out.
    .set(amount > 0 ? { amount } : { status: "cancelled", note: "Payment refunded" })
    .where(eq(referralCommissions.id, commission.id));
}
