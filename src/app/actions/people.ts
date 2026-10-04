"use server";

import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { certificates, enrollments, payments, users, type User } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { can, requirePermission } from "@/lib/auth";
import { sendEmails, type OutgoingEmail } from "@/lib/email";
import { peopleWhere, readPeopleFilter } from "@/lib/people";
import { absoluteUrl } from "@/lib/site";
import { deleteUpload } from "@/lib/storage";
import { issueToken } from "@/lib/tokens";
import { firstName } from "@/lib/utils";

export type BulkAction = "deactivate" | "reactivate" | "invite" | "delete";
/** Either the ticked people, or everyone matching the page's filters. */
export type BulkTarget = { ids: number[] } | { filter: { role?: string; status?: string; q?: string; country?: string } };
export type BulkResult = { ok?: string; error?: string; skipped?: { name: string; reason: string }[] };

const MAX_BULK = 5000;

async function targets(target: BulkTarget): Promise<User[]> {
  const db = await getDb();
  if ("ids" in target) {
    const ids = [...new Set(target.ids.filter((id) => Number.isInteger(id) && id > 0))].slice(0, MAX_BULK);
    return ids.length ? db.select().from(users).where(inArray(users.id, ids)) : [];
  }
  return db.select().from(users).where(peopleWhere(readPeopleFilter(target.filter))).limit(MAX_BULK);
}

/** People whose records must be kept: anyone who has paid, or holds a certificate. They can be deactivated instead. */
async function withRecords(ids: number[]): Promise<Map<number, string>> {
  const reasons = new Map<number, string>();
  if (!ids.length) return reasons;
  const db = await getDb();
  const [paid, certified] = await Promise.all([
    db.select({ userId: payments.userId, n: count() }).from(payments).where(and(inArray(payments.userId, ids), isNotNull(payments.paidAt))).groupBy(payments.userId),
    db.select({ userId: enrollments.userId }).from(certificates).innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId)).where(inArray(enrollments.userId, ids)),
  ]);
  for (const p of paid) reasons.set(p.userId, `Has ${p.n} payment${p.n === 1 ? "" : "s"} on record, so deactivate them instead`);
  for (const c of certified) if (!reasons.has(c.userId)) reasons.set(c.userId, "Has a certificate on record, so deactivate them instead");
  return reasons;
}

/** Checks one person against the rules that apply to every bulk action that removes access. */
async function accessProblem(actor: User, person: User, activeAdmins: { n: number }): Promise<string | null> {
  if (person.id === actor.id) return "That's you";
  const staffy = person.role === "admin" || person.role === "staff";
  if (staffy && !(await can(actor, "team.manage"))) return "Only people who manage the team can change administrators and team members";
  if (person.role === "admin" && person.active) {
    if (activeAdmins.n <= 1) return "They're the only active administrator";
    activeAdmins.n--;
  }
  return null;
}

export async function bulkPeople(action: BulkAction, target: BulkTarget): Promise<BulkResult> {
  const actor = await requirePermission("users.manage");
  const people = await targets(target);
  if (!people.length) return { error: "No one selected." };
  const db = await getDb();
  const skipped: { name: string; reason: string }[] = [];
  const [{ n: adminCount }] = await db.select({ n: count() }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true)));
  const activeAdmins = { n: adminCount };

  if (action === "invite") {
    const outgoing: OutgoingEmail[] = [];
    for (const person of people) {
      if (!person.active) { skipped.push({ name: person.name, reason: "Deactivated" }); continue; }
      if (person.passwordHash) { skipped.push({ name: person.name, reason: "Already set a password" }); continue; }
      const url = absoluteUrl(`/reset-password?token=${await issueToken(person.id, "invite")}`);
      outgoing.push(person.role === "student"
        ? { to: person.email, template: "student_account", vars: { name: firstName(person.name), setupUrl: url, coursesUrl: absoluteUrl("/courses") } }
        : { to: person.email, template: "invite", vars: { name: firstName(person.name), role: person.role, inviteUrl: url } });
    }
    const sent = await sendEmails(outgoing);
    if (outgoing.length) await logAudit(actor, { action: "users.invited", summary: `resent ${outgoing.length} invitation${outgoing.length === 1 ? "" : "s"}` });
    revalidatePath("/admin/users");
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const parts = [
      sent.sent && `Sent ${plural(sent.sent, "invitation")}.`,
      sent.logged && `${plural(sent.logged, "invitation")} written to the email log (email delivery isn't set up).`,
      sent.queued && `${plural(sent.queued, "invitation")} queued: today's sending limit is reached, so they'll go out automatically tomorrow.`,
      sent.failed && `${plural(sent.failed, "invitation")} failed. Check Settings › Email.`,
      !outgoing.length && "No invitations to send.",
    ].filter(Boolean);
    return { ok: parts.join(" "), error: sent.failed && !sent.sent && !sent.queued ? parts.join(" ") : undefined, skipped };
  }

  if (action === "reactivate") {
    const ids = people.filter((p) => !p.active).map((p) => p.id);
    if (ids.length) await db.update(users).set({ active: true }).where(inArray(users.id, ids));
    if (ids.length) await logAudit(actor, { action: "users.reactivated", summary: `reactivated ${ids.length} account${ids.length === 1 ? "" : "s"}` });
    revalidatePath("/admin/users");
    return { ok: `Reactivated ${ids.length} account${ids.length === 1 ? "" : "s"}.` };
  }

  // Deactivate and delete remove access, so the same rules apply.
  const allowed: User[] = [];
  for (const person of people) {
    const problem = action === "deactivate" && !person.active ? "Already deactivated" : await accessProblem(actor, person, activeAdmins);
    if (problem) skipped.push({ name: person.name, reason: problem });
    else allowed.push(person);
  }

  if (action === "deactivate") {
    const ids = allowed.map((p) => p.id);
    // Bumping the session version signs them out everywhere.
    if (ids.length) await db.update(users).set({ active: false, sessionVersion: sql`${users.sessionVersion} + 1` }).where(inArray(users.id, ids));
    if (ids.length) await logAudit(actor, { action: "users.deactivated", summary: `deactivated ${ids.length} account${ids.length === 1 ? "" : "s"}`, details: { ids } });
    revalidatePath("/admin/users");
    return { ok: `Deactivated ${ids.length} account${ids.length === 1 ? "" : "s"}.`, skipped };
  }

  const kept = await withRecords(allowed.map((p) => p.id));
  const removable = allowed.filter((p) => {
    const reason = kept.get(p.id);
    if (reason) skipped.push({ name: p.name, reason });
    return !reason;
  });
  if (removable.length) {
    await db.delete(users).where(inArray(users.id, removable.map((p) => p.id)));
    for (const p of removable) if (p.avatarUrl) await deleteUpload(p.avatarUrl).catch(() => {});
    await logAudit(actor, {
      action: "users.deleted",
      summary: removable.length === 1 ? `deleted ${removable[0].name} (${removable[0].email})` : `deleted ${removable.length} accounts`,
      details: { people: removable.map((p) => `${p.name} <${p.email}>`) },
    });
  }
  revalidatePath("/admin/users");
  return { ok: `Deleted ${removable.length} account${removable.length === 1 ? "" : "s"}.`, skipped };
}

/** Delete from a person's own page. */
export async function deletePerson(id: number): Promise<BulkResult> {
  const result = await bulkPeople("delete", { ids: [id] });
  if (result.skipped?.length) return { error: result.skipped[0].reason + "." };
  if (result.error) return result;
  redirect("/admin/users?deleted=1");
}
