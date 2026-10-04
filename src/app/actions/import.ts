"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { enrollments, users, type User } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { getCohortWithCourse } from "@/lib/data";
import { sendEmails, type OutgoingEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { absoluteUrl } from "@/lib/site";
import { readImport, type ImportRow } from "@/lib/student-import";
import { formatDateOnly } from "@/lib/time";
import { issueToken } from "@/lib/tokens";
import { firstName, MODE_LABEL } from "@/lib/utils";
import { markWaitlistEnrolled } from "@/lib/waitlist";

export type PreviewStatus = "new" | "existing" | "enrolled" | "skip";
export type PreviewRow = Omit<ImportRow, "error"> & { status: PreviewStatus; note?: string };
export type PreviewResult = { error?: string; rows?: PreviewRow[] };
export type ImportResult = { error?: string; created?: number; updated?: number; enrolled?: number; emailed?: boolean; skipped?: { line: number; email: string; reason: string }[] };

async function usersByEmail(emails: string[]): Promise<Map<string, User>> {
  const db = await getDb();
  const found = new Map<string, User>();
  for (let i = 0; i < emails.length; i += 500) {
    const chunk = emails.slice(i, i + 500);
    if (chunk.length) for (const u of await db.select().from(users).where(inArray(users.email, chunk))) found.set(u.email, u);
  }
  return found;
}

async function enrolledUserIds(cohortId: number | null, userIds: number[]): Promise<Set<number>> {
  if (!cohortId || !userIds.length) return new Set();
  const rows = await (await getDb()).select({ userId: enrollments.userId }).from(enrollments)
    .where(and(eq(enrollments.cohortId, cohortId), inArray(enrollments.userId, userIds), inArray(enrollments.status, ["active", "completed"])));
  return new Set(rows.map((r) => r.userId));
}

/** Sorts each row into new account, existing student, already on the cohort, or can't import. Nothing is saved. */
async function classify(csv: string, cohortId: number | null): Promise<PreviewRow[]> {
  const rows = readImport(csv);
  const existing = await usersByEmail(rows.filter((r) => !r.error).map((r) => r.email));
  const onCohort = await enrolledUserIds(cohortId, [...existing.values()].map((u) => u.id));
  return rows.map(({ error, ...row }) => {
    if (error) return { ...row, status: "skip", note: error };
    const user = existing.get(row.email);
    if (!user) return { ...row, status: "new" };
    if (user.role !== "student") return { ...row, status: "skip", note: `Already has an ${user.role === "instructor" ? "instructor" : "admin"} account` };
    if (onCohort.has(user.id)) return { ...row, status: "enrolled", note: "Already on this cohort" };
    return { ...row, status: "existing", note: user.name !== row.name ? `Has an account as ${user.name}` : "Has an account" };
  });
}

export async function previewImport(csv: string, cohortId: number | null): Promise<PreviewResult> {
  await requirePermission("users.manage");
  try {
    return { rows: await classify(csv, cohortId) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "We couldn't read that file." };
  }
}

/**
 * Creates student accounts from a CSV (people who already have one are matched by email), optionally enrols
 * everyone on a cohort, and optionally emails them: a set-password link for new accounts, plus the enrolment
 * confirmation when a cohort is chosen.
 */
export async function importStudents(csv: string, cohortId: number | null, sendEmailsToStudents: boolean): Promise<ImportResult> {
  const actor = await requirePermission("users.manage");
  let rows: PreviewRow[];
  try {
    rows = await classify(csv, cohortId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "We couldn't read that file." };
  }
  const found = cohortId ? await getCohortWithCourse(cohortId) : null;
  if (cohortId && !found) return { error: "That cohort no longer exists." };

  const db = await getDb();
  const skipped = rows.filter((r) => r.status === "skip").map((r) => ({ line: r.line, email: r.email, reason: r.note ?? "Skipped" }));

  // New accounts. A clash means someone else created the same email moments ago; they're matched below.
  const fresh = rows.filter((r) => r.status === "new");
  const created: User[] = [];
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200);
    created.push(...await db.insert(users)
      .values(chunk.map((r) => ({ name: r.name, email: r.email, phone: r.phone, gender: r.gender, country: r.country, role: "student" as const, passwordHash: null })))
      .onConflictDoNothing({ target: users.email })
      .returning());
  }

  // Existing students: fill in details they haven't given, never overwrite.
  const existingRows = rows.filter((r) => r.status === "existing" || r.status === "enrolled");
  const existing = await usersByEmail(existingRows.map((r) => r.email));
  let updated = 0;
  for (const row of existingRows) {
    const user = existing.get(row.email);
    if (!user) continue;
    const fill = { ...(!user.phone && row.phone ? { phone: row.phone } : {}), ...(!user.gender && row.gender ? { gender: row.gender } : {}), ...(!user.country && row.country ? { country: row.country } : {}) };
    if (Object.keys(fill).length) { await db.update(users).set(fill).where(eq(users.id, user.id)); updated++; }
  }

  // Enrolment.
  let enrolledIds: number[] = [];
  if (found) {
    const candidates = [...created, ...rows.filter((r) => r.status === "existing").map((r) => existing.get(r.email)).filter((u): u is User => Boolean(u))];
    const already = await enrolledUserIds(found.cohort.id, candidates.map((u) => u.id));
    const toEnrol = candidates.filter((u) => !already.has(u.id));
    const previous = toEnrol.length ? await db.select().from(enrollments).where(and(eq(enrollments.cohortId, found.cohort.id), inArray(enrollments.userId, toEnrol.map((u) => u.id)))) : [];
    const reactivate = previous.map((e) => e.id);
    if (reactivate.length) await db.update(enrollments).set({ status: "active", source: "manual", activatedAt: new Date() }).where(inArray(enrollments.id, reactivate));
    const insert = toEnrol.filter((u) => !previous.some((e) => e.userId === u.id));
    if (insert.length) await db.insert(enrollments).values(insert.map((u) => ({ userId: u.id, cohortId: found.cohort.id, status: "active" as const, source: "manual" as const, activatedAt: new Date() })));
    enrolledIds = toEnrol.map((u) => u.id);
    for (const u of toEnrol) await markWaitlistEnrolled(found.cohort.id, u.email);
    const { cohort, course } = found;
    await notify(enrolledIds, {
      kind: "enrollment",
      title: `You're enrolled on ${course.title}`,
      body: `${cohort.name}${cohort.startDate ? `, starting ${formatDateOnly(cohort.startDate)}` : ""}.`,
      href: `/dashboard/cohorts/${cohort.id}`,
      email: sendEmailsToStudents ? {
        template: "enrollment_confirmed",
        vars: { courseTitle: course.title, cohortName: cohort.name, startDate: formatDateOnly(cohort.startDate) || "To be confirmed", deliveryMode: MODE_LABEL[cohort.deliveryMode], dashboardUrl: absoluteUrl(`/dashboard/cohorts/${cohort.id}`) },
      } : undefined,
    });
  }

  // Set-password emails for the new accounts.
  if (sendEmailsToStudents && created.length) {
    const outgoing: OutgoingEmail[] = [];
    for (const user of created) {
      const url = absoluteUrl(`/reset-password?token=${await issueToken(user.id, "invite")}`);
      outgoing.push(found
        ? { to: user.email, template: "account_setup", vars: { name: firstName(user.name), courseTitle: found.course.title, setupUrl: url } }
        : { to: user.email, template: "invite", vars: { name: firstName(user.name), role: "student", inviteUrl: url } });
    }
    await sendEmails(outgoing);
  }

  const parts = [`${created.length} new`, existingRows.length && `${existingRows.length} existing`, found && `${enrolledIds.length} enrolled on ${found.course.title} – ${found.cohort.name}`].filter(Boolean).join(", ");
  await logAudit(actor, { action: "users.imported", summary: `imported students from a CSV (${parts})`, target: found ? { type: "cohort", id: found.cohort.id } : undefined, details: { skipped: skipped.length, emailed: sendEmailsToStudents } });
  revalidatePath("/admin/users");
  if (found) revalidatePath(`/teach/cohorts/${found.cohort.id}`);
  return { created: created.length, updated, enrolled: enrolledIds.length, emailed: sendEmailsToStudents, skipped };
}
