import "server-only";
import { and, count, desc, eq, ilike, or, sum, type SQL, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { PAYMENT_STATUSES, payments, users, type Gateway, type PaymentStatus } from "@/db/schema";

export type PaymentFilters = { status?: PaymentStatus; gateway?: Gateway; q?: string };

export function parsePaymentFilters(params: { status?: string; gateway?: string; q?: string }): PaymentFilters {
  return {
    status: PAYMENT_STATUSES.find((s) => s === params.status),
    gateway: (["stripe", "paystack", "transactpay", "manual", "test"] as const).find((g) => g === params.gateway),
    q: params.q?.trim() || undefined,
  };
}

export function paymentWhere(f: PaymentFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (f.status) parts.push(eq(payments.status, f.status));
  if (f.gateway) parts.push(eq(payments.gateway, f.gateway));
  if (f.q) {
    const like = `%${f.q}%`;
    parts.push(or(ilike(payments.reference, like), ilike(payments.description, like), ilike(users.name, like), ilike(users.email, like))!);
  }
  return parts.length ? and(...parts) : undefined;
}

export async function listPayments(f: PaymentFilters, { limit, offset }: { limit: number; offset: number }) {
  const db = await getDb();
  const where = paymentWhere(f);
  const [rows, [{ n }]] = await Promise.all([
    db.select({ payment: payments, user: { id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl, gender: users.gender } })
      .from(payments).innerJoin(users, eq(users.id, payments.userId)).where(where).orderBy(desc(payments.createdAt)).limit(limit).offset(offset),
    db.select({ n: count() }).from(payments).innerJoin(users, eq(users.id, payments.userId)).where(where),
  ]);
  return { rows, total: n };
}

/** Counts per status and paid totals per currency (net of refunds), for the summary cards. */
export async function paymentSummary() {
  const db = await getDb();
  const [byStatus, revenue] = await Promise.all([
    db.select({ status: payments.status, n: count() }).from(payments).groupBy(payments.status),
    db.select({ currency: payments.currency, total: sum(sql`${payments.amount} - ${payments.refundedAmount}`) }).from(payments).where(eq(payments.status, "paid")).groupBy(payments.currency),
  ]);
  const n = (s: PaymentStatus) => byStatus.find((b) => b.status === s)?.n ?? 0;
  return {
    total: byStatus.reduce((a, b) => a + b.n, 0),
    paid: n("paid"),
    pending: n("pending"),
    failed: n("failed"),
    revenue: revenue.map((r) => ({ currency: r.currency, total: Number(r.total) })),
  };
}
