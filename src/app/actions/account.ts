"use server";

import bcrypt from "bcryptjs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { notifications, users } from "@/db/schema";
import { createSession, requireUser } from "@/lib/auth";
import { passwordProblem } from "@/lib/password";
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
  await (await getDb()).update(users).set({ ...parsed.data, gender, avatarUrl, emailReminders: formData.get("emailReminders") === "on" }).where(eq(users.id, user.id));
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

export async function markRead(id: number): Promise<void> {
  const user = await requireUser();
  await (await getDb()).update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
}
