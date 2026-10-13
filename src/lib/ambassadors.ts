import "server-only";
import { and, countDistinct, desc, eq, gte, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { ambassadors, referralCommissions, users, type Ambassador, type AmbassadorSettings, type AmbassadorStatus } from "@/db/schema";
import { getSettings } from "./data";

export const DEFAULT_AMBASSADORS: AmbassadorSettings = { enabled: false, percent: 20, discountPercent: 10, pitch: "" };

export async function ambassadorConfig(): Promise<AmbassadorSettings> {
  return { ...DEFAULT_AMBASSADORS, ...((await getSettings()).ambassadors ?? {}) };
}

export const AMBASSADOR_STATUS_LABEL: Record<AmbassadorStatus, string> = { pending: "Applied", active: "Active", paused: "Paused", declined: "Declined" };
export const AMBASSADOR_STATUS_TONE = { pending: "amber", active: "green", paused: "neutral", declined: "red" } as const satisfies Record<AmbassadorStatus, string>;

export async function ambassadorFor(userId: number): Promise<Ambassador | null> {
  const [row] = await (await getDb()).select().from(ambassadors).where(eq(ambassadors.userId, userId));
  return row ?? null;
}

/** The person's ambassador record when they're active and the programme is on, else null. */
export async function activeAmbassador(userId: number): Promise<Ambassador | null> {
  const row = await ambassadorFor(userId);
  return row?.status === "active" && (await ambassadorConfig()).enabled ? row : null;
}

/** What this ambassador earns: their own rate, or the programme default. */
export function ambassadorRate(row: Pick<Ambassador, "percent">, config: AmbassadorSettings): number {
  return row.percent ?? config.percent;
}

/** "Ada L.": enough for ambassadors to recognise each other without full names. */
export function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  return `${first}${rest.length ? ` ${rest[rest.length - 1][0].toUpperCase()}.` : ""}`;
}

export type LeaderboardRow = { userId: number; name: string; students: number };

/** Ambassadors ranked by how many paying students they brought since `since` (cancelled commissions don't count). */
export async function ambassadorLeaderboard(since: Date, limit = 10): Promise<LeaderboardRow[]> {
  const rows = await (await getDb())
    .select({ userId: referralCommissions.referrerId, name: users.name, students: countDistinct(referralCommissions.referredUserId) })
    .from(referralCommissions).innerJoin(users, eq(users.id, referralCommissions.referrerId))
    .where(and(eq(referralCommissions.ambassador, true), ne(referralCommissions.status, "cancelled"), gte(referralCommissions.createdAt, since)))
    .groupBy(referralCommissions.referrerId, users.name)
    .orderBy(desc(countDistinct(referralCommissions.referredUserId)), referralCommissions.referrerId)
    .limit(limit);
  return rows.map((r) => ({ ...r, name: shortName(r.name) }));
}

/** The first moment of the current month, in UTC. */
export function startOfMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
