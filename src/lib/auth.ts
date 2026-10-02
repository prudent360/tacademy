import "server-only";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { cohortInstructors, cohorts, staffRoles, users, type Role, type User } from "@/db/schema";
import { PERMISSIONS, isPermission, type Permission } from "./permissions";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySessionToken } from "./session";

/** Signs the user in. Without "remember me", the cookie lasts until the browser closes (the token itself still expires as usual). */
export async function createSession(user: Pick<User, "id" | "role" | "sessionVersion">, { remember = true }: { remember?: boolean } = {}): Promise<void> {
  const token = await signSession({ userId: user.id, role: user.role, v: user.sessionVersion });
  // Shown on Team & roles.
  await (await getDb()).update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: SESSION_TTL_SECONDS } : {}),
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * The signed-in user, re-read from the database on each request so role changes,
 * deactivation and "sign out everywhere" take effect immediately.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const [user] = await (await getDb()).select().from(users).where(eq(users.id, session.userId));
  if (!user || !user.active || user.sessionVersion !== session.v) return null;
  return user;
});

/** Call at the top of every protected page and server action. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/login?denied=1");
  return user;
}

/** What someone may do in the admin area: everything for administrators, their role's list for staff, nothing otherwise. */
export const permissionsFor = cache(async (user: Pick<User, "id" | "role" | "staffRoleKey">): Promise<Set<Permission>> => {
  if (user.role === "admin") return new Set(PERMISSIONS);
  if (user.role !== "staff" || !user.staffRoleKey) return new Set();
  const [role] = await (await getDb()).select({ permissions: staffRoles.permissions }).from(staffRoles).where(eq(staffRoles.key, user.staffRoleKey));
  const granted = new Set((role?.permissions ?? []).filter(isPermission));
  // Without access to the admin area, nothing else can be reached.
  return granted.has("admin.access") ? granted : new Set();
});

export async function can(user: Pick<User, "id" | "role" | "staffRoleKey">, permission: Permission): Promise<boolean> {
  return (await permissionsFor(user)).has(permission);
}

/** Call at the top of admin pages and actions. People without the permission go back to their own home page. */
export async function requirePermission(permission: Permission): Promise<User> {
  const user = await requireUser();
  if (!(await can(user, permission))) redirect(user.role === "student" ? "/dashboard" : user.role === "instructor" ? "/teach?denied=1" : (await can(user, "admin.access")) ? "/admin?denied=1" : "/login?denied=1");
  return user;
}

/** Admins (and staff who manage courses) can manage every cohort; instructors only the ones they are assigned to. */
export async function canTeach(user: User, cohortId: number): Promise<boolean> {
  if (await can(user, "courses.manage")) return true;
  if (user.role !== "instructor") return false;
  const rows = await (await getDb())
    .select({ id: cohortInstructors.cohortId })
    .from(cohortInstructors)
    .where(and(eq(cohortInstructors.cohortId, cohortId), eq(cohortInstructors.userId, user.id)));
  return rows.length > 0;
}

export async function requireTeacher(cohortId: number): Promise<User> {
  const user = await requireUser();
  if (!(await canTeach(user, cohortId))) redirect(user.role === "student" ? "/dashboard" : "/teach?denied=1");
  return user;
}

/** Admins, or instructors who teach at least one cohort of the course, can build its modules and lessons. */
export async function requireCourseEditor(courseId: number): Promise<User> {
  const user = await requireUser();
  if (await can(user, "courses.manage")) return user;
  if (user.role !== "instructor") redirect(user.role === "student" ? "/dashboard" : "/teach?denied=1");
  const rows = await (await getDb())
    .select({ id: cohortInstructors.cohortId })
    .from(cohortInstructors)
    .innerJoin(cohorts, eq(cohorts.id, cohortInstructors.cohortId))
    .where(and(eq(cohortInstructors.userId, user.id), eq(cohorts.courseId, courseId)))
    .limit(1);
  if (!rows.length) redirect("/teach?denied=1");
  return user;
}
