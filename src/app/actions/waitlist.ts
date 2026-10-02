"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { cohortWaitlist } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { withCohorts } from "@/lib/catalog";
import { getCohortWithCourse } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { loginBlockedFor, recordLoginFailure } from "@/lib/rate-limit";
import { firstName } from "@/lib/utils";
import { email, firstError, required, text } from "@/lib/validation";
import { sendOffer, waitlistPosition } from "@/lib/waitlist";

export type WaitlistState = { error?: string; ok?: string } | undefined;

const schema = z.object({ name: required("Your name", 120), email, phone: text(40), website: text(200) });

/** The "Join the waitlist" form on a full cohort. */
export async function joinWaitlist(cohortId: number, _state: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const parsed = schema.safeParse({ name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone") ?? "", website: formData.get("website") ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };
  // Bots fill the hidden field; pretend it worked.
  if (parsed.data.website) return { ok: "You're on the waitlist." };
  const found = await getCohortWithCourse(cohortId);
  if (!found || !found.course.published) return { error: "This cohort is no longer available." };
  const [summary] = await withCohorts([found.course]);
  const cohort = summary.cohorts.find((c) => c.id === cohortId);
  if (cohort && !cohort.full) return { error: "Good news: there are places on this cohort. You can enrol now." };

  const wait = await loginBlockedFor(parsed.data.email, "waitlist");
  if (wait) return { error: `Too many attempts. Please try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  await recordLoginFailure(parsed.data.email, "waitlist");

  const db = await getDb();
  const [existing] = await db.select().from(cohortWaitlist).where(and(eq(cohortWaitlist.cohortId, cohortId), eq(cohortWaitlist.email, parsed.data.email)));
  if (existing && (existing.status === "waiting" || existing.status === "offered")) {
    return { ok: existing.status === "offered" ? "We've already emailed you a place. Check your inbox." : `You're already on the waitlist: number ${await waitlistPosition(existing)} in line.` };
  }
  const [entry] = existing
    ? await db.update(cohortWaitlist).set({ name: parsed.data.name, phone: parsed.data.phone, status: "waiting", offeredAt: null, createdAt: new Date() }).where(eq(cohortWaitlist.id, existing.id)).returning()
    : await db.insert(cohortWaitlist).values({ cohortId, name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone }).returning();
  const position = await waitlistPosition(entry);
  await sendEmail(entry.email, "waitlist_joined", { name: firstName(entry.name), courseTitle: found.course.title, cohortName: found.cohort.name, position: String(position) });
  revalidatePath(`/teach/cohorts/${cohortId}`);
  return { ok: `You're on the waitlist: number ${position} in line. We'll email you if a place opens.` };
}

async function loadEntry(id: number) {
  const [entry] = await (await getDb()).select().from(cohortWaitlist).where(eq(cohortWaitlist.id, id));
  return entry ?? null;
}

/** Offers a place to a specific person now, whatever their position (e.g. after adding a seat by hand). */
export async function offerWaitlistPlace(id: number): Promise<void> {
  const actor = await requirePermission("users.manage");
  const entry = await loadEntry(id);
  if (!entry || entry.status === "enrolled" || entry.status === "removed") return;
  await sendOffer(entry);
  await logAudit(actor, { action: "enrolment.waitlist_offer", summary: `offered a waitlist place to ${entry.name} (${entry.email})`, target: { type: "cohort", id: entry.cohortId } });
  revalidatePath(`/teach/cohorts/${entry.cohortId}`);
}

export async function removeFromWaitlist(id: number): Promise<void> {
  const actor = await requirePermission("users.manage");
  const entry = await loadEntry(id);
  if (!entry) return;
  await (await getDb()).update(cohortWaitlist).set({ status: "removed" }).where(eq(cohortWaitlist.id, id));
  await logAudit(actor, { action: "enrolment.waitlist_removed", summary: `removed ${entry.name} from a waitlist`, target: { type: "cohort", id: entry.cohortId } });
  revalidatePath(`/teach/cohorts/${entry.cohortId}`);
}
