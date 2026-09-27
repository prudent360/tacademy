import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { authTokens } from "@/db/schema";

type Purpose = "verify" | "reset" | "invite";

const TTL_MS: Record<Purpose, number> = {
  verify: 3 * 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
  invite: 7 * 24 * 60 * 60 * 1000,
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
