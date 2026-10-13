"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { ambassadors, discountCodes, users, type Ambassador } from "@/db/schema";
import { ambassadorConfig, ambassadorFor, ambassadorRate } from "@/lib/ambassadors";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireUser } from "@/lib/auth";
import { getAdmins } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { ensureReferralCode } from "@/lib/referrals";
import { absoluteUrl } from "@/lib/site";
import { firstName } from "@/lib/utils";
import { firstError, formValues, type FormState } from "@/lib/validation";

const revalidate = (id?: number) => {
  revalidatePath("/admin/ambassadors");
  if (id) revalidatePath(`/admin/ambassadors/${id}`);
  revalidatePath("/account/ambassador");
  revalidatePath("/ambassadors");
};

// ---------- Applying ----------

const applicationSchema = z.object({
  audience: z.string().trim().min(20, "Tell us a little more about who you reach (at least a sentence).").max(1000, "Keep it under 1,000 characters."),
  channels: z.string().trim().min(3, "Add at least one place you'll share, e.g. a social profile or group.").max(1000, "Keep it under 1,000 characters."),
  motivation: z.string().trim().min(20, "Tell us a little more about why you'd like to join.").max(2000, "Keep it under 2,000 characters."),
  terms: z.literal("on", "Please agree to the programme terms."),
});

export async function applyAsAmbassador(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await ambassadorConfig()).enabled) return { error: "The ambassador programme isn't taking applications right now." };
  const parsed = applicationSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { audience, channels, motivation } = parsed.data;
  const existing = await ambassadorFor(user.id);
  if (existing && existing.status !== "declined") return { error: existing.status === "pending" ? "You've already applied. We'll be in touch soon." : "You're already an ambassador." };
  const db = await getDb();
  // Someone declined before can apply again; their record goes back to the review queue.
  if (existing) await db.update(ambassadors).set({ status: "pending", audience, channels, motivation, decidedAt: null, decidedById: null, createdAt: new Date() }).where(eq(ambassadors.id, existing.id));
  else await db.insert(ambassadors).values({ userId: user.id, audience, channels, motivation });
  await sendEmail(user.email, "ambassador_application_received", { name: firstName(user.name) });
  await notify((await getAdmins()).map((a) => a.id), { kind: "ambassador", title: `New ambassador application: ${user.name}`, body: audience.slice(0, 140), href: "/admin/ambassadors" });
  revalidate();
  redirect("/account/ambassador?applied=1");
}

// ---------- Team ----------

async function load(id: number): Promise<{ row: Ambassador; person: typeof users.$inferSelect } | null> {
  const [found] = await (await getDb()).select({ row: ambassadors, person: users }).from(ambassadors).innerJoin(users, eq(users.id, ambassadors.userId)).where(eq(ambassadors.id, id));
  return found ?? null;
}

const rateValue = z.string().trim().refine((v) => v === "" || (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 90), "Commission must be a whole number from 1 to 90, or empty for the default.");
const discountValue = z.coerce.number().int().min(0, "The discount must be from 0 to 90%.").max(90, "The discount must be from 0 to 90%.");

const approveSchema = z.object({
  percent: rateValue,
  code: z.string().trim().toUpperCase().max(20).refine((v) => v === "" || /^[A-Z0-9]{3,20}$/.test(v), "Codes use 3–20 letters and numbers."),
  discountPercent: discountValue,
});

/** Approves an application: sets their rate, creates their personal discount code and welcomes them. */
export async function approveAmbassador(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("referrals.manage");
  const found = await load(id);
  if (!found) return { error: "This application no longer exists." };
  const { row, person } = found;
  if (row.status === "active") return { error: "They're already an ambassador." };
  const parsed = approveSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { percent, discountPercent } = parsed.data;
  if (discountPercent > 0 && !parsed.data.code) return { error: "Choose a discount code, or set the discount to 0% for none." };
  const db = await getDb();

  let discountCodeId = row.discountCodeId;
  if (discountPercent > 0) {
    const code = parsed.data.code;
    const [taken] = await db.select({ id: discountCodes.id }).from(discountCodes).where(and(eq(discountCodes.code, code), discountCodeId ? ne(discountCodes.id, discountCodeId) : undefined));
    if (taken) return { error: `The code ${code} is already in use. Choose another.` };
    if (discountCodeId) await db.update(discountCodes).set({ code, percentOff: discountPercent, active: true, ownerId: person.id }).where(eq(discountCodes.id, discountCodeId));
    else [{ id: discountCodeId }] = await db.insert(discountCodes).values({ code, percentOff: discountPercent, ownerId: person.id }).returning({ id: discountCodes.id }) as [{ id: number }];
  } else if (discountCodeId) {
    await db.update(discountCodes).set({ active: false }).where(eq(discountCodes.id, discountCodeId));
  }

  await db.update(ambassadors).set({ status: "active", percent: percent === "" ? null : Number(percent), discountCodeId, decidedById: actor.id, decidedAt: new Date() }).where(eq(ambassadors.id, id));
  await ensureReferralCode(person);
  const config = await ambassadorConfig();
  const rate = percent === "" ? config.percent : Number(percent);
  await notify([person.id], {
    kind: "ambassador",
    title: "You're now an ambassador",
    body: `You earn ${rate}% on every course the people you bring take.`,
    href: "/account/ambassador",
    email: { template: "ambassador_approved", vars: {
      percent: String(rate),
      discountLine: discountPercent > 0 ? `- Your followers get **${discountPercent}% off** with your personal code **${parsed.data.code}**, and every sale using it counts as yours, even if they never clicked your link.` : "",
      dashboardUrl: absoluteUrl("/account/ambassador"),
    } },
  });
  await logAudit(actor, { action: "ambassador.approved", summary: `approved ${person.name} as an ambassador at ${rate}%${discountPercent > 0 ? ` with the code ${parsed.data.code}` : ""}`, target: { type: "user", id: person.id } });
  revalidate(id);
  return { ok: `${person.name} is now an ambassador.` };
}

export async function declineAmbassador(id: number): Promise<void> {
  const actor = await requirePermission("referrals.manage");
  const found = await load(id);
  if (!found || found.row.status !== "pending") return;
  await (await getDb()).update(ambassadors).set({ status: "declined", decidedById: actor.id, decidedAt: new Date() }).where(eq(ambassadors.id, id));
  await sendEmail(found.person.email, "ambassador_declined", { name: firstName(found.person.name) });
  await logAudit(actor, { action: "ambassador.declined", summary: `declined ${found.person.name}'s ambassador application`, target: { type: "user", id: found.person.id } });
  revalidate(id);
}

/** Paused ambassadors earn at the normal Refer & earn rate and their discount code stops working. */
export async function setAmbassadorPaused(id: number, paused: boolean): Promise<void> {
  const actor = await requirePermission("referrals.manage");
  const found = await load(id);
  if (!found || found.row.status !== (paused ? "active" : "paused")) return;
  const db = await getDb();
  await db.update(ambassadors).set({ status: paused ? "paused" : "active" }).where(eq(ambassadors.id, id));
  if (found.row.discountCodeId) await db.update(discountCodes).set({ active: !paused }).where(eq(discountCodes.id, found.row.discountCodeId));
  await logAudit(actor, { action: paused ? "ambassador.paused" : "ambassador.resumed", summary: `${paused ? "paused" : "resumed"} ${found.person.name} as an ambassador`, target: { type: "user", id: found.person.id } });
  revalidate(id);
}

const updateSchema = z.object({ percent: rateValue, discountPercent: discountValue, adminNotes: z.string().trim().max(2000), code: approveSchema.shape.code.optional() });

/** Changes an ambassador's rate or discount, and the team's private notes. New rates apply to future sales only. */
export async function updateAmbassador(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("referrals.manage");
  const found = await load(id);
  if (!found) return { error: "This ambassador no longer exists." };
  const parsed = updateSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { percent, discountPercent, adminNotes, code } = parsed.data;
  const db = await getDb();
  let discountCodeId = found.row.discountCodeId;
  // Someone approved without a code can be given one later.
  if (!discountCodeId && code && discountPercent > 0) {
    const [taken] = await db.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.code, code));
    if (taken) return { error: `The code ${code} is already in use. Choose another.` };
    [{ id: discountCodeId }] = await db.insert(discountCodes).values({ code, percentOff: discountPercent, ownerId: found.person.id, active: found.row.status === "active" }).returning({ id: discountCodes.id }) as [{ id: number }];
  } else if (!discountCodeId && discountPercent > 0) {
    return { error: "Add a code to give them a discount." };
  }
  await db.update(ambassadors).set({ percent: percent === "" ? null : Number(percent), adminNotes, discountCodeId }).where(eq(ambassadors.id, id));
  if (found.row.discountCodeId) {
    // 0% switches the code off; the code itself is kept so past sales stay linked to it.
    await db.update(discountCodes).set({ percentOff: Math.max(1, discountPercent), active: discountPercent > 0 && found.row.status === "active" }).where(eq(discountCodes.id, found.row.discountCodeId));
  }
  const rate = ambassadorRate({ percent: percent === "" ? null : Number(percent) }, await ambassadorConfig());
  await logAudit(actor, { action: "ambassador.updated", summary: `updated ${found.person.name}'s ambassador terms (${rate}% commission, ${discountPercent}% discount)`, target: { type: "user", id: found.person.id } });
  revalidate(id);
  return { ok: "Saved. New rates apply to sales from now on." };
}
