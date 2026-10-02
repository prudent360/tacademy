import "server-only";
import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { cohorts, courses, curriculumRequests, enrollments, payments, users } from "@/db/schema";

export const RANGES = [
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "12m", label: "Last 12 months", days: 365 },
  { key: "ytd", label: "This year", days: 0 },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"];

export function rangeStart(key: RangeKey, now = new Date()): Date {
  if (key === "ytd") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const days = RANGES.find((r) => r.key === key)!.days;
  return new Date(now.getTime() - days * 86_400_000);
}

type Money = Map<string, number>;
const add = (m: Money, currency: string, value: number) => m.set(currency, (m.get(currency) ?? 0) + value);

export type CourseRow = { courseId: number; title: string; kind: string; enrolments: number; payments: number; gross: Money; refunds: Money; net: Money };

/** Everything on the Reports page for one period. Amounts are in minor units, per currency. */
export async function buildReport(key: RangeKey) {
  const db = await getDb();
  const since = rangeStart(key);
  const [paid, enrolled, leads] = await Promise.all([
    // Money that came in during the period (refunds are counted against the payment they belong to).
    db.select({ payment: payments, courseId: courses.id, title: courses.title, kind: courses.kind })
      .from(payments).leftJoin(cohorts, eq(cohorts.id, payments.cohortId)).leftJoin(courses, eq(courses.id, cohorts.courseId))
      .where(and(inArray(payments.status, ["paid", "refunded"]), isNotNull(payments.paidAt), gte(payments.paidAt, since))),
    db.select({ enrollment: enrollments, courseId: courses.id, title: courses.title, kind: courses.kind, email: users.email })
      .from(enrollments).innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId)).innerJoin(courses, eq(courses.id, cohorts.courseId)).innerJoin(users, eq(users.id, enrollments.userId))
      .where(and(inArray(enrollments.status, ["active", "completed"]), gte(enrollments.createdAt, since))),
    db.select().from(curriculumRequests).where(gte(curriculumRequests.createdAt, since)),
  ]);

  const gross: Money = new Map();
  const refunds: Money = new Map();
  const byGateway = new Map<string, { count: number; net: Money }>();
  const byCourse = new Map<number, CourseRow>();
  const row = (courseId: number | null, title: string | null, kind: string | null): CourseRow | null => {
    if (!courseId) return null;
    if (!byCourse.has(courseId)) byCourse.set(courseId, { courseId, title: title ?? "Course", kind: kind ?? "course", enrolments: 0, payments: 0, gross: new Map(), refunds: new Map(), net: new Map() });
    return byCourse.get(courseId)!;
  };
  for (const { payment: p, courseId, title, kind } of paid) {
    add(gross, p.currency, p.amount);
    add(refunds, p.currency, p.refundedAmount);
    const g = byGateway.get(p.gateway) ?? { count: 0, net: new Map() };
    g.count++;
    add(g.net, p.currency, p.amount - p.refundedAmount);
    byGateway.set(p.gateway, g);
    const r = row(courseId, title, kind);
    if (r) {
      r.payments++;
      add(r.gross, p.currency, p.amount);
      add(r.refunds, p.currency, p.refundedAmount);
      add(r.net, p.currency, p.amount - p.refundedAmount);
    }
  }
  for (const e of enrolled) {
    const r = row(e.courseId, e.title, e.kind);
    if (r) r.enrolments++;
  }
  const net: Money = new Map([...gross].map(([c, v]) => [c, v - (refunds.get(c) ?? 0)]));

  // Curriculum requests that turned into an enrolment (same email, enrolled after asking).
  const enrolledAt = new Map<string, Date[]>();
  for (const e of enrolled) enrolledAt.set(e.email.toLowerCase(), [...(enrolledAt.get(e.email.toLowerCase()) ?? []), e.enrollment.createdAt]);
  const converted = leads.filter((l) => (enrolledAt.get(l.email.toLowerCase()) ?? []).some((d) => d >= l.createdAt)).length;

  // Monthly series (months that overlap the period, oldest first).
  const months: { key: string; label: string }[] = [];
  const cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1));
  while (cursor <= new Date()) {
    months.push({ key: cursor.toISOString().slice(0, 7), label: cursor.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const revenueByMonth = (currency: string) => months.map((m) => paid.filter((p) => p.payment.currency === currency && p.payment.paidAt?.toISOString().startsWith(m.key)).reduce((sum, p) => sum + p.payment.amount - p.payment.refundedAmount, 0));
  const enrolmentsByMonth = months.map((m) => ({ label: m.label, value: enrolled.filter((e) => e.enrollment.createdAt.toISOString().startsWith(m.key)).length }));

  return {
    since,
    gross, refunds, net,
    paymentCount: paid.length,
    refundCount: paid.filter((p) => p.payment.refundedAmount > 0).length,
    enrolments: enrolled.length,
    paidEnrolments: enrolled.filter((e) => e.enrollment.source === "payment").length,
    leads: leads.length,
    converted,
    courses: [...byCourse.values()].sort((a, b) => b.enrolments - a.enrolments || b.payments - a.payments),
    gateways: [...byGateway.entries()].map(([gateway, v]) => ({ gateway, ...v })).sort((a, b) => b.count - a.count),
    months,
    revenueByMonth,
    enrolmentsByMonth,
  };
}
