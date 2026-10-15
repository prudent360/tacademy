import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { payments, programmeEnrollments, type Cohort, type Programme, type ProgrammeEnrollment, type User } from "@/db/schema";
import { bankTransferConfig } from "./config";
import { getAdmins } from "./data";
import { formatMoney } from "./money";
import { notify } from "./notify";
import { beginOnlinePayment, findDiscount, newReference, type Purchase } from "./payments";
import { programmeName, programmeQuote, type ProgrammePlan, type ProgrammeQuote } from "./programme-pricing";
import { absoluteUrl } from "./site";

const programmePurchase = (programme: Programme): Purchase => ({ cohortId: null, programmeId: programme.id, product: "programme", cancelUrl: absoluteUrl(`/programmes/${programme.slug}?cancelled=1`) });

function describe(programme: Programme, q: Pick<ProgrammeQuote, "count">, n: number, code?: string): string {
  return `${programmeName(programme.title)}${q.count > 1 ? ` – instalment ${n} of ${q.count}` : ""}${code ? ` · ${code}` : ""}`;
}

/**
 * Saves the student's pending programme place with the agreed terms (replacing an earlier unfinished checkout)
 * and starts the first payment, online or by bank transfer.
 */
export async function startProgrammeCheckout(user: User, programme: Programme, firstCohort: Cohort, input: { currency: string; plan: ProgrammePlan; method: "online" | "bank"; discountCode: string }): Promise<{ url: string; reference: string } | { error: string }> {
  const found = input.discountCode.trim() ? await findDiscount(input.discountCode) : null;
  if (found && "error" in found) return found;
  const discount = found ?? undefined;
  const bank = input.method === "bank" ? await bankTransferConfig() : null;
  if (bank && !bank.enabled) return { error: "Bank transfer isn't available." };
  const currency = bank ? bank.currency : input.currency;
  const q = programmeQuote(programme, currency, input.plan, discount?.percentOff ?? 0);
  if (!q) return { error: `This programme isn't sold in ${currency}.` };

  const db = await getDb();
  const terms = { currency, total: q.total, instalmentCount: q.count, firstAmount: q.first, restAmount: q.rest, firstCohortId: firstCohort.id };
  const [existing] = await db.select().from(programmeEnrollments).where(and(eq(programmeEnrollments.userId, user.id), eq(programmeEnrollments.programmeId, programme.id)));
  if (existing?.status === "active") return { error: "You're already on this programme. Find it under My courses." };
  if (existing) await db.update(programmeEnrollments).set({ ...terms, status: "pending" }).where(eq(programmeEnrollments.id, existing.id));
  else await db.insert(programmeEnrollments).values({ ...terms, userId: user.id, programmeId: programme.id });

  const description = describe(programme, q, 1, discount?.code);
  const details = { amount: q.first, originalAmount: q.fee, paymentPlan: q.count > 1 ? "instalment" as const : "full" as const, discountCodeId: discount?.id, description };
  if (!bank) return beginOnlinePayment(user, programmePurchase(programme), currency, details);

  // Reuse an open transfer for the same programme and amount rather than creating duplicates.
  const open = await db.select().from(payments).where(and(eq(payments.userId, user.id), eq(payments.programmeId, programme.id), eq(payments.gateway, "manual"), eq(payments.status, "pending")));
  const same = open.find((p) => p.amount === q.first && p.currency === currency);
  if (same) return { url: `/checkout/transfer?ref=${same.reference}`, reference: same.reference };
  if (open.length) await db.update(payments).set({ status: "failed" }).where(inArray(payments.id, open.map((p) => p.id)));
  const reference = newReference();
  await db.insert(payments).values({ reference, userId: user.id, cohortId: null, programmeId: programme.id, product: "programme", gateway: "manual", amount: q.first, currency, description, originalAmount: q.fee, paymentPlan: details.paymentPlan, discountCodeId: discount?.id });
  await notify((await getAdmins()).map((a) => a.id), {
    kind: "payment",
    title: `Bank transfer expected: ${formatMoney(q.first, currency)}`,
    body: `${user.name} chose bank transfer for ${description} (ref ${reference}).`,
    href: "/admin/payments?status=pending",
  });
  return { url: `/checkout/transfer?ref=${reference}`, reference };
}

export type InstalmentStatus = {
  paid: number;
  /** Instalments that should have been paid by now (the first is due at once, then one a month). */
  due: number;
  /** The next unpaid instalment, if any. */
  next: { number: number; amount: number; dueDate: Date } | null;
  overdue: boolean;
};

/** Adds whole months, keeping to the end of shorter months (31 Jan + 1 month = 28/29 Feb). */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d;
}

/** Where a student is with their programme instalments. Refunded payments don't count as paid. */
export async function instalmentStatus(enrolment: ProgrammeEnrollment): Promise<InstalmentStatus> {
  const rows = await (await getDb()).select({ id: payments.id }).from(payments)
    .where(and(eq(payments.userId, enrolment.userId), eq(payments.programmeId, enrolment.programmeId), eq(payments.currency, enrolment.currency), eq(payments.status, "paid")));
  const paid = rows.length;
  const start = enrolment.activatedAt ?? new Date();
  const now = new Date();
  let due = 0;
  while (due < enrolment.instalmentCount && addMonths(start, due) <= now) due++;
  const next = paid < enrolment.instalmentCount ? { number: paid + 1, amount: paid === 0 ? enrolment.firstAmount : enrolment.restAmount, dueDate: addMonths(start, paid) } : null;
  return { paid, due: Math.max(due, 1), next, overdue: paid < Math.max(due, 1) };
}

/** Starts an online payment for the student's next programme instalment. */
export async function startInstalmentCheckout(user: User, programme: Programme, enrolment: ProgrammeEnrollment): Promise<{ url: string } | { error: string }> {
  if (enrolment.status !== "active") return { error: "This programme isn't active." };
  const status = await instalmentStatus(enrolment);
  if (!status.next) return { error: "This programme is already paid in full." };
  const db = await getDb();
  // An instalment checkout that was opened and abandoned is replaced, so it can't be paid twice.
  await db.update(payments).set({ status: "failed" }).where(and(eq(payments.userId, user.id), eq(payments.programmeId, programme.id), eq(payments.status, "pending"), ne(payments.gateway, "manual")));
  return beginOnlinePayment(user, programmePurchase(programme), enrolment.currency, {
    amount: status.next.amount,
    originalAmount: enrolment.total,
    paymentPlan: "instalment",
    description: describe(programme, { count: enrolment.instalmentCount }, status.next.number),
  });
}
