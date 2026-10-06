"use server";

import bcrypt from "bcryptjs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { notifications, users } from "@/db/schema";
import { createSession, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getSettings } from "@/lib/data";
import { passwordProblem } from "@/lib/password";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { generateTotpSecret, verifyTotp } from "@/lib/totp";
import { deleteIfReplaced } from "@/lib/storage";
import { resolveFileField, uploadErrorMessage } from "@/lib/upload-field";
import { firstError, text, type FormState } from "@/lib/validation";

const profileSchema = z.object({
  name: text(120).min(2, "Enter your full name."),
  phone: text(40),
  bio: text(600),
});

export async function updateProfile(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({ name: formData.get("name"), phone: formData.get("phone") ?? "", bio: formData.get("bio") ?? "" });
  const gender = formData.get("gender") === "female" ? "female" : formData.get("gender") === "male" ? "male" : null;
  if (!parsed.success) return { error: firstError(parsed.error) };
  let avatarUrl: string | null;
  try {
    avatarUrl = await resolveFileField(formData, { file: "avatar", remove: "removeAvatar", current: user.avatarUrl, folder: "avatars" });
  } catch (error) {
    const message = uploadErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }
  await (await getDb()).update(users).set({ ...parsed.data, gender, avatarUrl, emailReminders: formData.get("emailReminders") === "on", ...(formData.get("whatsappShown") === "1" ? { whatsappOptIn: formData.get("whatsappOptIn") === "on" } : {}) }).where(eq(users.id, user.id));
  await deleteIfReplaced(user.avatarUrl, avatarUrl);
  revalidatePath("/", "layout");
  return { ok: "Profile saved." };
}

export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const problem = passwordProblem(next, "The new password");
  if (problem) return { error: problem };
  if (next !== String(formData.get("confirm") ?? "")) return { error: "The new passwords do not match." };
  if (!user.passwordHash || !(await bcrypt.compare(current, user.passwordHash))) return { error: "Your current password is incorrect." };

  // Signs out other devices; this one gets a fresh session below.
  const [updated] = await (await getDb())
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next, 12), sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, user.id))
    .returning();
  await createSession(updated);
  return { ok: "Password updated. Other devices have been signed out." };
}

export async function markAllRead(): Promise<void> {
  const user = await requireUser();
  await (await getDb()).update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
}

/** Closes the dashboard pop-up for good (on every device), until its message changes. */
export async function dismissAnnouncement(version: string): Promise<void> {
  const user = await requireUser();
  await (await getDb()).update(users).set({ announcementSeen: version.slice(0, 40) }).where(eq(users.id, user.id));
}

export async function markRead(id: number): Promise<void> {
  const user = await requireUser();
  await (await getDb()).update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
}

// ---------- Two-factor sign-in ----------

/** Creates a new authenticator secret to scan; it only takes effect once confirmed with a code. */
export async function startTwoFactorSetup(): Promise<void> {
  const user = await requireUser();
  if (user.totpEnabledAt) return;
  await (await getDb()).update(users).set({ totpSecret: encryptSecret(generateTotpSecret()) }).where(eq(users.id, user.id));
  revalidatePath("/account");
}

export async function cancelTwoFactorSetup(): Promise<void> {
  const user = await requireUser();
  if (user.totpEnabledAt) return;
  await (await getDb()).update(users).set({ totpSecret: null }).where(eq(users.id, user.id));
  revalidatePath("/account");
}

export async function confirmTwoFactor(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.totpEnabledAt) return { ok: "Two-factor sign-in is already on." };
  if (!user.totpSecret || !verifyTotp(decryptSecret(user.totpSecret), String(formData.get("code") ?? ""))) return { error: "That code isn't right. Scan the QR code again and enter the newest code." };
  await (await getDb()).update(users).set({ totpEnabledAt: new Date() }).where(eq(users.id, user.id));
  await logAudit(user, { action: "user.two_factor_on", summary: "switched on two-factor sign-in", target: { type: "user", id: user.id } });
  revalidatePath("/", "layout");
  return { ok: "Two-factor sign-in is on. You'll be asked for a code each time you sign in." };
}

export async function disableTwoFactor(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.totpEnabledAt || !user.totpSecret) return { ok: "Two-factor sign-in is already off." };
  const settings = await getSettings();
  if (settings.requireStaffTwoFactor && (user.role === "admin" || user.role === "staff")) return { error: "The academy requires two-factor sign-in for the team, so it can't be switched off." };
  if (!verifyTotp(decryptSecret(user.totpSecret), String(formData.get("code") ?? ""))) return { error: "That code isn't right." };
  await (await getDb()).update(users).set({ totpSecret: null, totpEnabledAt: null }).where(eq(users.id, user.id));
  await logAudit(user, { action: "user.two_factor_off", summary: "switched off two-factor sign-in", target: { type: "user", id: user.id } });
  revalidatePath("/", "layout");
  return { ok: "Two-factor sign-in is off." };
}
