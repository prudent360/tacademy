"use server";

import { and, count, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { cohortInstructors, settings, staffRoles, users, type User } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { PERMISSIONS, isPermission } from "@/lib/permissions";
import { absoluteUrl } from "@/lib/site";
import { issueToken } from "@/lib/tokens";
import { firstName } from "@/lib/utils";
import { email as emailSchema, firstError, required, text, type FormState } from "@/lib/validation";

const PATH = "/admin/team";
/** The "role" value meaning Administrator; anything else is a staff role key. */
const ADMIN = "admin";

async function roleLabel(value: string): Promise<string | null> {
  if (value === ADMIN) return "Administrator";
  const [role] = await (await getDb()).select({ name: staffRoles.name }).from(staffRoles).where(eq(staffRoles.key, value));
  return role?.name ?? null;
}

/** The team member being changed: not yourself, and an admin or staff account. */
async function target(id: number, me: User): Promise<User | string> {
  if (id === me.id) return "You can't change your own access here.";
  const [user] = await (await getDb()).select().from(users).where(eq(users.id, id));
  if (!user || (user.role !== "admin" && user.role !== "staff")) return "That team member no longer exists.";
  return user;
}

/** Stops the academy being left without an active administrator. */
async function isLastAdmin(user: User): Promise<boolean> {
  if (user.role !== "admin" || !user.active) return false;
  const [{ n }] = await (await getDb()).select({ n: count() }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true), ne(users.id, user.id)));
  return n === 0;
}

// ---------- Members ----------

const inviteSchema = z.object({ name: required("Name", 120), email: emailSchema, role: z.string().min(1, "Choose a role.") });

/** Invites someone to the team, or gives an existing student or instructor account team access. */
export async function inviteTeamMember(_state: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePermission("team.manage");
  const parsed = inviteSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const label = await roleLabel(parsed.data.role);
  if (!label) return { error: "Choose a role." };
  const access = parsed.data.role === ADMIN ? { role: "admin" as const, staffRoleKey: null } : { role: "staff" as const, staffRoleKey: parsed.data.role };
  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, parsed.data.email));
  if (existing && (existing.role === "admin" || existing.role === "staff")) return { error: "They're already on the team. Change their role in the list above." };
  let user: User;
  if (existing) {
    [user] = await db.update(users).set({ ...access, active: true }).where(eq(users.id, existing.id)).returning();
  } else {
    [user] = await db.insert(users).values({ name: parsed.data.name, email: parsed.data.email, ...access, passwordHash: null }).returning();
  }
  const url = user.passwordHash ? absoluteUrl("/login") : absoluteUrl(`/reset-password?token=${await issueToken(user.id, "invite")}`);
  await sendEmail(user.email, "invite", { name: firstName(user.name), role: label, inviteUrl: url });
  await logAudit(me, { action: "team.invited", summary: `${existing ? "gave" : "invited"} ${user.name} (${user.email}) ${existing ? "team access as" : "to the team as"} ${label}`, target: { type: "user", id: user.id } });
  revalidatePath(PATH);
  return { ok: existing ? `${user.name} already had an account; they're now ${label} and have been emailed.` : `Invitation sent to ${user.email}.` };
}

export async function changeMemberRole(userId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePermission("team.manage");
  const member = await target(userId, me);
  if (typeof member === "string") return { error: member };
  const value = String(formData.get("role") ?? "");
  const label = await roleLabel(value);
  if (!label) return { error: "Choose a role." };
  const current = member.role === "admin" ? ADMIN : member.staffRoleKey ?? "";
  if (value === current) return undefined;
  if (value !== ADMIN && (await isLastAdmin(member))) return { error: "They're the only active administrator. Make someone else an administrator first." };
  await (await getDb()).update(users).set(value === ADMIN ? { role: "admin", staffRoleKey: null } : { role: "staff", staffRoleKey: value }).where(eq(users.id, member.id));
  await logAudit(me, { action: "team.role_changed", summary: `changed ${member.name}'s role to ${label}`, target: { type: "user", id: member.id }, details: { from: current, to: value } });
  revalidatePath(PATH);
  return { ok: `${member.name} is now ${label}.` };
}

export async function setMemberActive(userId: number, active: boolean): Promise<void> {
  const me = await requirePermission("team.manage");
  const member = await target(userId, me);
  if (typeof member === "string") return;
  if (!active && (await isLastAdmin(member))) return;
  // Deactivating signs them out everywhere straight away.
  await (await getDb()).update(users).set(active ? { active: true } : { active: false, sessionVersion: member.sessionVersion + 1 }).where(eq(users.id, member.id));
  await logAudit(me, { action: active ? "team.reactivated" : "team.deactivated", summary: `${active ? "restored" : "removed"} ${member.name}'s access`, target: { type: "user", id: member.id } });
  revalidatePath(PATH);
}

/** Takes someone off the team: they become an instructor again if they teach a cohort, otherwise a student. History stays. */
export async function removeFromTeam(userId: number): Promise<void> {
  const me = await requirePermission("team.manage");
  const member = await target(userId, me);
  if (typeof member === "string" || (await isLastAdmin(member))) return;
  const [teaches] = await (await getDb()).select({ id: cohortInstructors.cohortId }).from(cohortInstructors).where(eq(cohortInstructors.userId, member.id)).limit(1);
  const role = teaches ? "instructor" : "student";
  await (await getDb()).update(users).set({ role, staffRoleKey: null }).where(eq(users.id, member.id));
  await logAudit(me, { action: "team.removed", summary: `removed ${member.name} from the team (now ${role})`, target: { type: "user", id: member.id } });
  revalidatePath(PATH);
}

export async function resendTeamInvite(userId: number): Promise<void> {
  const me = await requirePermission("team.manage");
  const member = await target(userId, me);
  if (typeof member === "string" || member.passwordHash) return;
  const label = (await roleLabel(member.role === "admin" ? ADMIN : member.staffRoleKey ?? "")) ?? "Team member";
  await sendEmail(member.email, "invite", { name: firstName(member.name), role: label, inviteUrl: absoluteUrl(`/reset-password?token=${await issueToken(member.id, "invite")}`) });
  await logAudit(me, { action: "team.invite_resent", summary: `resent ${member.name}'s invitation`, target: { type: "user", id: member.id } });
}

// ---------- Roles ----------

const roleSchema = z.object({ name: required("Role name", 60), description: text(200) });

export async function createRole(_state: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePermission("team.manage");
  const parsed = roleSchema.safeParse({ name: formData.get("name"), description: formData.get("description") ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const base = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "role";
  if (base === ADMIN) return { error: "Choose a different name; Administrator is built in." };
  const taken = new Set((await db.select({ key: staffRoles.key }).from(staffRoles)).map((r) => r.key));
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}-${i}`;
  // Optionally start from another role's permissions.
  const copyFrom = String(formData.get("copyFrom") ?? "");
  const [source] = copyFrom ? await db.select({ permissions: staffRoles.permissions }).from(staffRoles).where(eq(staffRoles.key, copyFrom)) : [];
  await db.insert(staffRoles).values({ key, name: parsed.data.name, description: parsed.data.description, permissions: source?.permissions ?? ["admin.access"] });
  await logAudit(me, { action: "role.created", summary: `created the role “${parsed.data.name}”`, target: { type: "role", id: key } });
  revalidatePath(PATH);
  return { ok: `${parsed.data.name} created. Tick what it can do below.` };
}

/** Saves the permission grid: one checkbox per role and permission, named "<roleKey>:<permission>". */
export async function saveRolePermissions(_state: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePermission("team.manage");
  const db = await getDb();
  const roles = await db.select().from(staffRoles);
  const changes: string[] = [];
  for (const role of roles) {
    const granted = PERMISSIONS.filter((p) => formData.get(`${role.key}:${p}`) === "on");
    const before = role.permissions.filter(isPermission);
    if (granted.length === before.length && granted.every((p) => before.includes(p))) continue;
    await db.update(staffRoles).set({ permissions: granted }).where(eq(staffRoles.key, role.key));
    const added = granted.filter((p) => !before.includes(p));
    const removed = before.filter((p) => !granted.includes(p));
    changes.push(role.name);
    await logAudit(me, { action: "role.permissions_changed", summary: `changed what ${role.name} can do`, target: { type: "role", id: role.key }, details: { added, removed } });
  }
  revalidatePath("/", "layout");
  return { ok: changes.length ? `Saved: ${changes.join(", ")}.` : "No changes to save." };
}

/** Deletes a role nobody has (the page only offers it then). */
export async function deleteRole(key: string): Promise<void> {
  const me = await requirePermission("team.manage");
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(users).where(and(eq(users.staffRoleKey, key), inArray(users.role, ["staff"])));
  if (n > 0) return;
  const [removed] = await db.delete(staffRoles).where(eq(staffRoles.key, key)).returning({ name: staffRoles.name });
  if (removed) await logAudit(me, { action: "role.deleted", summary: `deleted the role “${removed.name}”`, target: { type: "role", id: key } });
  revalidatePath(PATH);
}

/** For someone who lost their phone: switches their two-factor off and signs them out. */
export async function resetMemberTwoFactor(userId: number): Promise<void> {
  const me = await requirePermission("team.manage");
  const member = await target(userId, me);
  if (typeof member === "string") return;
  await (await getDb()).update(users).set({ totpSecret: null, totpEnabledAt: null, sessionVersion: member.sessionVersion + 1 }).where(eq(users.id, member.id));
  await logAudit(me, { action: "team.two_factor_reset", summary: `reset ${member.name}'s two-factor sign-in`, target: { type: "user", id: member.id } });
  revalidatePath(PATH);
}

/** Whether administrators and team members must use two-factor sign-in. */
export async function setTeamTwoFactorRequired(required: boolean): Promise<void> {
  const me = await requirePermission("team.manage");
  // The settings row may not exist yet on a new academy.
  await (await getDb()).insert(settings).values({ id: 1, requireStaffTwoFactor: required }).onConflictDoUpdate({ target: settings.id, set: { requireStaffTwoFactor: required, updatedAt: new Date() } });
  await logAudit(me, { action: "team.two_factor_policy", summary: `${required ? "required" : "stopped requiring"} two-factor sign-in for the team` });
  revalidatePath("/", "layout");
}
