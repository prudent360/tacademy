"use server";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, getCurrentUser, requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { passwordProblem } from "@/lib/password";
import { clearLoginFailures, loginBlockedFor, recordLoginFailure } from "@/lib/rate-limit";
import { homeFor, PENDING_COOKIE, sessionSecretProblem, signPendingSignIn, verifyPendingSignIn } from "@/lib/session";
import { decryptSecret } from "@/lib/secrets";
import { verifyTotp } from "@/lib/totp";
import { absoluteUrl } from "@/lib/site";
import { consumeToken, issueToken } from "@/lib/tokens";
import { firstName } from "@/lib/utils";
import { email as emailSchema, safeNext, type FormState } from "@/lib/validation";

// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = "$2b$12$5VB7dnnjtjRUJ7XA3FtvMuH/4ycLw3wFUgRnowYDR9B0x55JAdpBu";

function secretError(): FormState {
  const problem = sessionSecretProblem();
  if (!problem) return undefined;
  console.error(`Sign-in blocked: ${problem}`);
  return { error: "Sign-in isn't configured on the server: SESSION_SECRET is missing or too short." };
}

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const waitMinutes = await loginBlockedFor(email);
  if (waitMinutes) return { error: `Too many failed attempts. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.` };

  const [user] = await (await getDb()).select().from(users).where(eq(users.email, email));
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !valid) {
    await recordLoginFailure(email);
    return { error: "Incorrect email or password." };
  }
  if (!user.active) return { error: "This account has been deactivated. Please contact the academy." };

  await clearLoginFailures(email);
  const blocked = secretError();
  if (blocked) return blocked;
  const remember = formData.get("remember") === "on";
  const next = safeNext(formData.get("next"));
  // With two-factor on, the password only gets them as far as the code page.
  if (user.totpEnabledAt) await startTwoFactorStep(user, remember, next);
  await createSession(user, { remember });
  redirect(next ?? homeFor(user.role));
}

async function startTwoFactorStep(user: { id: number; sessionVersion: number }, remember: boolean, next: string | null): Promise<never> {
  (await cookies()).set(PENDING_COOKIE, await signPendingSignIn({ userId: user.id, v: user.sessionVersion, remember, next }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  redirect("/login/verify");
}

/** The second step of signing in: the 6-digit code from their authenticator app. */
export async function verifyTwoFactorSignIn(_state: FormState, formData: FormData): Promise<FormState> {
  const jar = await cookies();
  const pending = await verifyPendingSignIn(jar.get(PENDING_COOKIE)?.value);
  if (!pending) return { error: "That sign-in took too long. Please sign in again." };
  const [user] = await (await getDb()).select().from(users).where(eq(users.id, pending.userId));
  if (!user || !user.active || user.sessionVersion !== pending.v || !user.totpEnabledAt || !user.totpSecret) return { error: "Please sign in again." };
  const scope = `2fa:${user.id}`;
  const waitMinutes = await loginBlockedFor(scope);
  if (waitMinutes) return { error: `Too many wrong codes. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.` };
  if (!verifyTotp(decryptSecret(user.totpSecret), String(formData.get("code") ?? ""))) {
    await recordLoginFailure(scope);
    return { error: "That code isn't right. Check the time on your phone and try the newest code." };
  }
  await clearLoginFailures(scope);
  jar.delete(PENDING_COOKIE);
  await createSession(user, { remember: pending.remember });
  redirect(pending.next ?? homeFor(user.role));
}

async function sendVerification(user: { id: number; email: string; name: string }, template: "welcome" | "verify_email") {
  const token = await issueToken(user.id, "verify");
  await sendEmail(user.email, template, { name: firstName(user.name), verifyUrl: absoluteUrl(`/verify-email?token=${token}`) });
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function resendVerification(): Promise<void> {
  const user = await requireUser();
  if (!user.emailVerifiedAt) await sendVerification(user, "verify_email");
}

export async function requestPasswordReset(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const done: FormState = { ok: "If an account exists for that email, we've sent a link to reset the password. It expires in 1 hour." };

  const waitMinutes = await loginBlockedFor(parsed.data, "reset");
  if (waitMinutes) return done;
  await recordLoginFailure(parsed.data, "reset");

  const [user] = await (await getDb()).select().from(users).where(eq(users.email, parsed.data));
  if (user?.active) {
    const token = await issueToken(user.id, "reset");
    await sendEmail(user.email, "password_reset", { name: firstName(user.name), resetUrl: absoluteUrl(`/reset-password?token=${token}`) });
  }
  return done;
}

/** Sets a new password from a reset or invitation link, then signs the user in. */
export async function resetPassword(_state: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The passwords do not match." };

  const userId = await consumeToken(String(formData.get("token") ?? ""), ["reset", "invite"]);
  if (!userId) return { error: "This link is invalid or has expired. Request a new one." };

  const db = await getDb();
  const [user] = await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(password, 12),
      sessionVersion: sql`${users.sessionVersion} + 1`,
      // The link arrived by email, so the address is confirmed.
      emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`,
    })
    .where(eq(users.id, userId))
    .returning();
  if (!user) return { error: "This account no longer exists." };
  const blocked = secretError();
  if (blocked) return blocked;
  // A reset link proves the email, not the phone: two-factor still applies.
  if (user.totpEnabledAt) await startTwoFactorStep(user, true, null);
  await createSession(user);
  redirect(homeFor(user.role));
}

/** Used by the verify-email page. */
export async function verifyEmailToken(token: string): Promise<boolean> {
  const userId = await consumeToken(token, ["verify"]);
  if (!userId) return false;
  await (await getDb()).update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  return true;
}

export async function currentHome(): Promise<string | null> {
  const user = await getCurrentUser();
  return user ? homeFor(user.role) : null;
}
