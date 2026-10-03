import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { authTokens } from "@/db/schema";

type Purpose = "verify" | "reset" | "invite" | "code";

const TTL_MS: Record<Purpose, number> = {
  verify: 3 * 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
  invite: 7 * 24 * 60 * 60 * 1000,
  code: 10 * 60 * 1000,
};

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Issues a one-time token and returns the raw value to put in a link. Earlier unused tokens stop working. */
export async function issueToken(userId: number, purpose: Purpose): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
  await db.insert(authTokens).values({ userId, purpose, tokenHash: hash(token), expiresAt: new Date(Date.now() + TTL_MS[purpose]) });
  return token;
}

/** Returns the user id for a valid, unused token without using it up. */
export async function peekToken(token: string, purposes: Purpose[]): Promise<number | null> {
  if (!token) return null;
  const [row] = await (await getDb())
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hash(token)), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())));
  return row && purposes.includes(row.purpose) ? row.userId : null;
}

/** Marks a token used and returns its user id, or null if it is invalid, expired or already used. */
export async function consumeToken(token: string, purposes: Purpose[]): Promise<number | null> {
  if (!token) return null;
  const [row] = await (await getDb())
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.tokenHash, hash(token)), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .returning();
  return row && purposes.includes(row.purpose) ? row.userId : null;
}

const codeDigest = (salt: string, userId: number, code: string) => createHash("sha256").update(`${salt}:${userId}:${code}`).digest("hex");

/** Issues a 6-digit email code (valid for 10 minutes) and returns it. Earlier unused codes stop working. */
export async function issueCode(userId: number): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  const db = await getDb();
  await db.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, "code"), isNull(authTokens.usedAt)));
  await db.insert(authTokens).values({ userId, purpose: "code", tokenHash: `${salt}.${codeDigest(salt, userId, code)}`, expiresAt: new Date(Date.now() + TTL_MS.code) });
  return code;
}

/** Uses up the user's current email code if `code` matches it. */
export async function consumeCode(userId: number, code: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, "code"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .orderBy(desc(authTokens.id))
    .limit(1);
  if (!row) return false;
  const [salt, digest] = row.tokenHash.split(".");
  const expected = Buffer.from(digest, "hex");
  const given = Buffer.from(codeDigest(salt, userId, code.replace(/\D/g, "")), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
  return true;
}
