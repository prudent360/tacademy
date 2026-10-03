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
import { countryByCode } from "@/lib/countries";
import { homeFor, PENDING_COOKIE, sessionSecretProblem, signPendingSignIn, signPendingVerification, VERIFY_COOKIE, verifyPendingSignIn, verifyPendingVerification } from "@/lib/session";
import { decryptSecret } from "@/lib/secrets";
import { verifyTotp } from "@/lib/totp";
import { absoluteUrl } from "@/lib/site";
import { consumeCode, consumeToken, issueCode, issueToken } from "@/lib/tokens";
import { firstName } from "@/lib/utils";
import { dialCode, email as emailSchema, formatPhone, phoneNumber, safeNext, type FormState } from "@/lib/validation";

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
  // Students who signed up but never entered their email code do that first.
  if (user.role === "student" && !user.emailVerifiedAt) await startEmailCodeStep(user, { remember, next, welcome: false });
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

/**
 * Open sign-up: anyone can create a student account, then enrol whenever they're ready. Someone who enrolled
 * before without setting a password is emailed a link to set one instead of getting a second account.
 */
export async function register(_state: FormState, formData: FormData): Promise<FormState> {
  const clean = (key: string) => String(formData.get(key) ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  const firstNameValue = clean("firstName");
  const lastNameValue = clean("lastName");
  const name = `${firstNameValue} ${lastNameValue}`.trim();
  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const gender = String(formData.get("gender") ?? "");
  const country = countryByCode(String(formData.get("country") ?? ""))?.code;
  const dial = dialCode.safeParse(formData.get("dialCode"));
  const phone = phoneNumber.safeParse(formData.get("phone"));
  // Bots fill the hidden field; pretend it worked.
  if (String(formData.get("website") ?? "")) redirect("/login");
  if (!firstNameValue) return { error: "Enter your first name." };
  if (!lastNameValue) return { error: "Enter your last name." };
  if (!parsedEmail.success) return { error: "Enter a valid email address." };
  const email = parsedEmail.data;
  if (gender !== "female" && gender !== "male") return { error: "Choose your gender." };
  if (!country) return { error: "Choose the country you live in." };
  if (!dial.success || !phone.success) return { error: "Enter a valid phone number." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The passwords don't match." };
  if (formData.get("terms") !== "on") return { error: "Please agree to the terms and privacy policy to create an account." };

  const waitMinutes = await loginBlockedFor(email, "register");
  if (waitMinutes) return { error: `Too many attempts. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.` };
  await recordLoginFailure(email, "register");

  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing?.passwordHash) return { error: "You already have an account with this email. Sign in, or use “Forgot password” if you can't remember it." };
  if (existing) {
    // An account made when they enrolled: let them set the password from their inbox, which proves the email is theirs.
    const token = await issueToken(existing.id, "reset");
    await sendEmail(existing.email, "password_reset", { name: firstName(existing.name), resetUrl: absoluteUrl(`/reset-password?token=${token}`) });
    return { ok: "You already have an account from when you enrolled. We've emailed you a link to set your password." };
  }

  const blocked = secretError();
  if (blocked) return blocked;
  const [user] = await db
    .insert(users)
    .values({ name, email, gender, country, phone: formatPhone(dial.data, phone.data), role: "student", passwordHash: await bcrypt.hash(password, 12) })
    .returning();
  await startEmailCodeStep(user, { remember: true, next: safeNext(formData.get("next")), welcome: true });
}

/** Emails a 6-digit code and sends them to the page where they type it in. */
async function startEmailCodeStep(user: { id: number; email: string; name: string }, pending: { remember: boolean; next: string | null; welcome: boolean }): Promise<never> {
  await sendEmail(user.email, "email_code", { name: firstName(user.name), code: await issueCode(user.id) });
  (await cookies()).set(VERIFY_COOKIE, await signPendingVerification({ userId: user.id, ...pending }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
  redirect("/register/verify");
}

/** Checks the emailed code, confirms the address and signs them in. */
export async function verifyEmailCode(_state: FormState, formData: FormData): Promise<FormState> {
  const jar = await cookies();
  const pending = await verifyPendingVerification(jar.get(VERIFY_COOKIE)?.value);
  if (!pending) return { error: "This page has expired. Please sign in to get a new code." };
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, pending.userId));
  if (!user || !user.active) return { error: "Please sign in again." };
  const scope = `code:${user.id}`;
  const waitMinutes = await loginBlockedFor(scope);
  if (waitMinutes) return { error: `Too many wrong codes. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}, or ask for a new code.` };
  if (!(await consumeCode(user.id, String(formData.get("code") ?? "")))) {
    await recordLoginFailure(scope);
    return { error: "That code isn't right, or it has expired. Check the newest email from us, or send a new code." };
  }
  await clearLoginFailures(scope);
  const blocked = secretError();
  if (blocked) return blocked;
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
  jar.delete(VERIFY_COOKIE);
  if (pending.welcome) await sendEmail(user.email, "welcome", { name: firstName(user.name), dashboardUrl: absoluteUrl("/dashboard"), coursesUrl: absoluteUrl("/courses") });
  await createSession(user, { remember: pending.remember });
  redirect(pending.next ?? (pending.welcome ? "/dashboard?welcome=1" : homeFor(user.role)));
}

/** Sends a fresh code (limited to a few an hour). */
export async function resendEmailCode(): Promise<FormState> {
  const pending = await verifyPendingVerification((await cookies()).get(VERIFY_COOKIE)?.value);
  if (!pending) return { error: "This page has expired. Please sign in to get a new code." };
  const [user] = await (await getDb()).select().from(users).where(eq(users.id, pending.userId));
  if (!user || !user.active || user.emailVerifiedAt) return { error: "Please sign in again." };
  const scope = `resend:${user.id}`;
  const waitMinutes = await loginBlockedFor(scope);
  if (waitMinutes) return { error: `You've asked for several codes. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.` };
  await recordLoginFailure(scope);
  await sendEmail(user.email, "email_code", { name: firstName(user.name), code: await issueCode(user.id) });
  return { ok: `We've sent a new code to ${user.email}.` };
}

async function sendVerification(user: { id: number; email: string; name: string }) {
  const token = await issueToken(user.id, "verify");
  await sendEmail(user.email, "verify_email", { name: firstName(user.name), verifyUrl: absoluteUrl(`/verify-email?token=${token}`) });
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function resendVerification(): Promise<void> {
  const user = await requireUser();
  if (!user.emailVerifiedAt) await sendVerification(user);
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
