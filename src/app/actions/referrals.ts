"use server";

import { and, eq, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { referralCommissions, users, type PayoutDetails } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { formatMoney } from "@/lib/money";
import { absoluteUrl } from "@/lib/site";
import { firstName } from "@/lib/utils";
import type { FormState } from "@/lib/validation";

/** The referrer's own "where to pay me" details. */
export async function savePayoutDetails(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const field = (key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);
  const details: PayoutDetails = {
    method: formData.get("method") === "other" ? "other" : "bank",
    bankName: field("bankName", 120),
    accountName: field("accountName", 120),
    accountNumber: field("accountNumber", 40),
    other: field("other", 500),
  };
  if (details.method === "bank" && (!details.bankName || !details.accountName || !details.accountNumber)) return { error: "Add your bank, account name and account number." };
  if (details.method === "bank" && !/^[\d\s-]{6,34}$|^[A-Z]{2}\d{2}[A-Z0-9 ]{10,30}$/i.test(details.accountNumber)) return { error: "That account number doesn't look right." };
  if (details.method === "other" && details.other.length < 5) return { error: "Tell us how you'd like to be paid." };
  await (await getDb()).update(users).set({ payoutDetails: details }).where(eq(users.id, user.id));
  revalidatePath("/account/referrals");
  return { ok: "Payout details saved." };
}

/** Marks everything payable to one person in one currency as paid, and tells them. */
export async function markCommissionsPaid(referrerId: number, currency: string, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("referrals.manage");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const db = await getDb();
  const ready = await db.select().from(referralCommissions).where(and(
    eq(referralCommissions.referrerId, referrerId),
    eq(referralCommissions.currency, currency),
    eq(referralCommissions.status, "pending"),
    lte(referralCommissions.availableAt, new Date()),
  ));
  if (!ready.length) return { error: "Nothing is payable to them in this currency right now." };
  const total = ready.reduce((sum, c) => sum + c.amount, 0);
  await db.update(referralCommissions).set({ status: "paid", paidAt: new Date(), paidById: actor.id, note }).where(inArray(referralCommissions.id, ready.map((c) => c.id)));
  const [referrer] = await db.select().from(users).where(eq(users.id, referrerId));
  const money = formatMoney(total, currency);
  if (referrer) {
    await sendEmail(referrer.email, "referral_paid", { name: firstName(referrer.name), amount: money, note: note ? `Payment note: ${note}` : "", referralsUrl: absoluteUrl("/account/referrals") });
  }
  await logAudit(actor, { action: "referral.paid", summary: `paid ${money} referral commission to ${referrer?.name ?? "a referrer"}`, target: { type: "user", id: referrerId }, details: { commissions: ready.map((c) => c.id), note } });
  revalidatePath("/admin/referrals");
  // The "ready to pay" line disappears once paid, so the confirmation shows on the Paid list instead.
  redirect(`/admin/referrals?state=paid&done=${encodeURIComponent(`Marked ${money} as paid${referrer ? ` to ${referrer.name}` : ""}. They've been emailed.`)}`);
}

/** Cancels one commission that hasn't been paid (e.g. a fake sign-up). */
export async function cancelCommission(id: number): Promise<void> {
  const actor = await requirePermission("referrals.manage");
  const db = await getDb();
  const [row] = await db.update(referralCommissions).set({ status: "cancelled", note: "Cancelled by the academy" }).where(and(eq(referralCommissions.id, id), eq(referralCommissions.status, "pending"))).returning();
  if (row) await logAudit(actor, { action: "referral.cancelled", summary: `cancelled a ${formatMoney(row.amount, row.currency)} referral commission (${row.courseTitle})`, target: { type: "user", id: row.referrerId } });
  revalidatePath("/admin/referrals");
}
