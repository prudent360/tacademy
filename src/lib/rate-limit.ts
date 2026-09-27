import "server-only";
import { and, count, eq, gte, inArray, lt, min, or } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { loginAttempts } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
/** Failures allowed per address and email pair, and per address overall, within the window. */
const MAX_PER_ACCOUNT = 5;
const MAX_PER_ADDRESS = 20;

async function clientAddress(): Promise<string> {
  const h = await headers();
  // Vercel sets x-forwarded-for itself, so the first entry is the real client.
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function keys(address: string, email: string, scope: string) {
  return { address: `${scope}|ip:${address}`, account: `${scope}|ip:${address}|email:${email}` };
}

/** Returns the minutes to wait if this address is currently blocked, otherwise null. */
export async function loginBlockedFor(email: string, scope = "login"): Promise<number | null> {
  const { address, account } = keys(await clientAddress(), email, scope);
  const db = await getDb();
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await db
    .select({ key: loginAttempts.key, n: count(), oldest: min(loginAttempts.createdAt) })
    .from(loginAttempts)
    .where(and(inArray(loginAttempts.key, [address, account]), gte(loginAttempts.createdAt, since)))
    .groupBy(loginAttempts.key);

  const hits = (key: string) => rows.find((row) => row.key === key);
  const accountHits = hits(account);
  const addressHits = hits(address);
  const blocked =
    (accountHits && accountHits.n >= MAX_PER_ACCOUNT ? accountHits : undefined) ??
    (addressHits && addressHits.n >= MAX_PER_ADDRESS ? addressHits : undefined);
  if (!blocked) return null;
  const oldest = blocked.oldest ? new Date(blocked.oldest).getTime() : Date.now();
  return Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 60000));
}

export async function recordLoginFailure(email: string, scope = "login"): Promise<void> {
  const { address, account } = keys(await clientAddress(), email, scope);
  const db = await getDb();
  await db.insert(loginAttempts).values([{ key: address }, { key: account }]);
  // Keep the table small.
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}

export async function clearLoginFailures(email: string, scope = "login"): Promise<void> {
  const { address, account } = keys(await clientAddress(), email, scope);
  const db = await getDb();
  await db.delete(loginAttempts).where(or(eq(loginAttempts.key, account), eq(loginAttempts.key, address)));
}
