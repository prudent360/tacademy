import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/db/schema";

/** Session token helpers. Safe to import from proxy.ts (no Node-only APIs). */
export const SESSION_COOKIE = "academy_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export type SessionPayload = { userId: number; role: Role; v: number };

/** Describes what is wrong with SESSION_SECRET, or returns null when it is usable. */
export function sessionSecretProblem(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) return "SESSION_SECRET is not set.";
  if (secret.length < 32) return `SESSION_SECRET is only ${secret.length} characters; it needs at least 32.`;
  return null;
}

function secretKey(): Uint8Array {
  const problem = sessionSecretProblem();
  if (problem) throw new Error(`${problem} Generate one with: openssl rand -base64 32`);
  return new TextEncoder().encode(process.env.SESSION_SECRET!.trim());
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "number" || typeof payload.role !== "string" || typeof payload.v !== "number") return null;
    return { userId: payload.userId, role: payload.role as Role, v: payload.v };
  } catch {
    return null;
  }
}

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "instructor") return "/teach";
  return "/dashboard";
}
