import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import Stripe from "stripe";
import { getDb } from "@/db";
import { discountCodes, enrollments, payments, users, type Cohort, type Course, type EnrollmentSource, type Payment, type PaymentPlan, type User } from "@/db/schema";
import { getAdmins, getCohortWithCourse, getSettings } from "./data";
import { sendEmails } from "./email";
import { bankTransferConfig, gatewayConfig, type Gateway } from "./config";
import { CURRENCY_CODES, formatMoney, gatewayFor, MOBILE_MONEY_DIAL, mobileMoneyCountries } from "./money";
import { notify } from "./notify";
import { PART_PAYMENT_PLANS, quote, type EnrolPlan } from "./pricing";
import { absoluteUrl } from "./site";
import { issueToken } from "./tokens";
import { formatDateOnly } from "./time";
import { firstName, MODE_LABEL } from "./utils";

/** True when the gateway is switched on in Settings and has a secret key. */
export async function gatewayConfigured(gateway: Gateway): Promise<boolean> {
  const cfg = await gatewayConfig(gateway);
  return cfg.enabled && Boolean(cfg.secretKey);
}

/** Local development can complete purchases on a simulated checkout page when a gateway has no keys. */
export function testPaymentsAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
}

export type PayMethod = "card" | "mobile";

/**
 * Currencies students can pay in right now, by method (gateway enabled, and keys set or test mode available).
 * card: Stripe or Paystack · mobile: pawaPay mobile money.
 */
export async function payableMethods(): Promise<Record<PayMethod, string[]>> {
  const [stripeCfg, paystackCfg, pawapayCfg] = await Promise.all([gatewayConfig("stripe"), gatewayConfig("paystack"), gatewayConfig("pawapay")]);
  const ok = (cfg: typeof stripeCfg) => cfg.enabled && (Boolean(cfg.secretKey) || testPaymentsAllowed());
  return {
    card: CURRENCY_CODES.filter((code) => { const g = gatewayFor(code); return g !== "pawapay" && ok(g === "stripe" ? stripeCfg : paystackCfg); }),
    mobile: ok(pawapayCfg) ? CURRENCY_CODES.filter((code) => mobileMoneyCountries(code).length > 0) : [],
  };
}

/** Currencies students can pay in online by any method. */
export async function payableCurrencies(): Promise<string[]> {
  const { card, mobile } = await payableMethods();
  return CURRENCY_CODES.filter((code) => card.includes(code) || mobile.includes(code));
}

const stripeClients = new Map<string, Stripe>();
function stripe(secretKey: string): Stripe {
  if (!stripeClients.has(secretKey)) stripeClients.set(secretKey, new Stripe(secretKey));
  return stripeClients.get(secretKey)!;
}

async function paystack<T>(secretKey: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = (await response.json()) as { status: boolean; message: string; data: T };
  if (!response.ok || !data.status) throw new Error(`Paystack: ${data.message ?? response.status}`);
  return data.data;
}

/** pawaPay's API; sandbox and live use separate tokens. */
async function pawapay<T>(cfg: { secretKey: string; mode: "test" | "live" }, path: string, init?: RequestInit): Promise<T> {
  const base = cfg.mode === "live" ? "https://api.pawapay.io" : "https://api.sandbox.pawapay.io";
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.secretKey}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & { failureReason?: { failureCode: string; failureMessage: string } };
  if (!response.ok || data.failureReason) throw new Error(`pawaPay: ${data.failureReason?.failureCode ?? response.status} ${data.failureReason?.failureMessage ?? ""}`.trim());
  return data;
}

/** Francophone markets get pawaPay's payment page in French. */
const FRENCH_COUNTRIES = ["SEN", "CIV", "BEN", "BFA", "CMR", "COG", "GAB"];

/**
 * Most mobile money providers only accept whole amounts (no cents), so mobile money payments are
 * rounded to whole units before they're recorded.
 */
function wholeUnits(minor: number): number {
  return Math.round(minor / 100) * 100;
}

function newReference(): string {
  return `TSU-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function describePurchase(course: Course, cohort: Cohort): string {
  return `${course.title} – ${cohort.name}`;
}

async function beginOnlinePayment(user: User, course: Course, cohort: Cohort, currency: string, details: {
  amount: number;
  originalAmount: number;
  paymentPlan: PaymentPlan;
  registrationFee?: number;
  discountCodeId?: number | null;
  description: string;
  method?: PayMethod;
  /** pawaPay country (ISO alpha-3); needed when a currency spans several countries. */
  country?: string;
}): Promise<{ url: string; reference: string } | { error: string }> {
  const { originalAmount, paymentPlan, registrationFee = 0, discountCodeId, description } = details;
  const gateway = details.method === "mobile" || gatewayFor(currency) === "pawapay" ? "pawapay" : gatewayFor(currency);
  const countries = mobileMoneyCountries(currency);
  const country = gateway !== "pawapay" ? undefined : details.country && countries.includes(details.country) ? details.country : countries.length === 1 ? countries[0] : undefined;
  if (gateway === "pawapay" && !countries.length) return { error: `Mobile money isn't available in ${currency}. Please choose another option.` };
  if (gateway === "pawapay" && !country) return { error: "Choose the country your mobile money account is registered in." };
  const amount = gateway === "pawapay" ? wholeUnits(details.amount) : details.amount;
  const cfg = await gatewayConfig(gateway);
  if (!cfg.enabled) return { error: `${gateway === "pawapay" ? "Mobile money payments are" : `Payments in ${currency} are`} currently switched off. Please choose another option.` };
  const configured = Boolean(cfg.secretKey);
  if (!configured && !testPaymentsAllowed()) return { error: `Online payments in ${currency} aren't set up yet. Please contact us to enrol.` };

  const reference = newReference();
  const db = await getDb();
  await db.insert(payments).values({ reference, userId: user.id, cohortId: cohort.id, gateway: configured ? gateway : "test", providerId: configured ? null : `simulated:${gateway}`, amount, currency, description, originalAmount, paymentPlan, registrationFee, discountCodeId });
  const returnUrl = absoluteUrl(`/checkout/return?ref=${reference}`);
  if (!configured) return { url: `/checkout/test?ref=${reference}`, reference };

  try {
    if (gateway === "stripe") {
      const session = await stripe(cfg.secretKey).checkout.sessions.create({
        mode: "payment",
        customer_email: user.email,
        client_reference_id: reference,
        metadata: { reference },
        payment_intent_data: { metadata: { reference }, description },
        line_items: [{ quantity: 1, price_data: { currency: currency.toLowerCase(), unit_amount: amount, product_data: { name: description } } }],
        success_url: returnUrl,
        cancel_url: absoluteUrl(`/courses/${course.slug}?cancelled=1`),
      });
      await db.update(payments).set({ providerId: session.id }).where(eq(payments.reference, reference));
      return { url: session.url!, reference };
    }

    if (gateway === "pawapay") {
      // pawaPay needs a UUID; our reference travels in the metadata. Shown on the customer's phone: 4–22 letters, digits and spaces.
      const depositId = randomUUID();
      const statement = (await getSettings()).siteName.replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 22).trim();
      const { redirectUrl } = await pawapay<{ redirectUrl: string }>(cfg, "/v2/paymentpage", {
        method: "POST",
        body: JSON.stringify({
          depositId,
          returnUrl,
          amountDetails: { amount: String(amount / 100), currency },
          country,
          language: FRENCH_COUNTRIES.includes(country!) ? "FR" : "EN",
          reason: description.slice(0, 50),
          ...(statement.length >= 4 ? { customerMessage: statement } : {}),
          metadata: [{ reference }],
        }),
      });
      await db.update(payments).set({ providerId: depositId }).where(eq(payments.reference, reference));
      return { url: redirectUrl, reference };
    }

    const data = await paystack<{ authorization_url: string; reference: string }>(cfg.secretKey, "/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({ email: user.email, amount, currency, reference, callback_url: returnUrl, metadata: { reference, cohortId: cohort.id, userId: user.id } }),
    });
    await db.update(payments).set({ providerId: data.reference }).where(eq(payments.reference, reference));
    return { url: data.authorization_url, reference };
  } catch (error) {
    console.error("Checkout failed", error);
    await db.update(payments).set({ status: "failed" }).where(eq(payments.reference, reference));
    return { error: "We couldn't start the payment. Please try again in a moment." };
  }
}

function planNote(plan: EnrolPlan, cohort: Cohort, registrationFee: number): string {
  const parts = [registrationFee ? "registration fee" : "", plan === "deposit" ? `${cohort.depositPercent}% deposit` : plan === "full" && registrationFee ? "full tuition" : ""].filter(Boolean);
  return parts.length ? ` (${parts.join(" + ")})` : "";
}

/**
 * Creates a pending payment and returns the URL to send the student to:
 * Stripe Checkout, Paystack's or pawaPay's payment page, or the local test checkout.
 */
export async function startCheckout(user: User, course: Course, cohort: Cohort, currency: string, options: { plan?: EnrolPlan; discountCode?: string; method?: PayMethod; country?: string } = {}): Promise<{ url: string; reference: string } | { error: string }> {
  const plan = options.plan ?? "full";
  const base = quote(cohort, currency, plan);
  if (!base.dueNow) return { error: "This cohort isn't sold in that currency." };
  const db = await getDb();
  const requestedCode = options.discountCode?.trim().toUpperCase();
  const [discount] = requestedCode ? await db.select().from(discountCodes).where(and(eq(discountCodes.code, requestedCode), eq(discountCodes.active, true), or(isNull(discountCodes.expiresAt), sql`${discountCodes.expiresAt} > now()`))) : [];
  if (requestedCode && (!discount || (discount.maxUses !== null && discount.usedCount >= discount.maxUses))) return { error: "That discount code is invalid or has expired." };
  const q = quote(cohort, currency, plan, discount?.percentOff ?? 0);
  const paymentPlan = q.later > 0 ? plan : "full";
  const description = `${describePurchase(course, cohort)}${planNote(paymentPlan, cohort, q.registrationFee)}${discount ? ` · ${discount.code}` : ""}`;
  return beginOnlinePayment(user, course, cohort, currency, { amount: q.dueNow, originalAmount: q.tuitionPrice, paymentPlan, registrationFee: q.registrationFee, discountCodeId: discount?.id, description, method: options.method, country: options.country });
}

export type PaymentBalance = { total: number; paid: number; remaining: number; currency: string };

/** Calculates the agreed tuition and what is still owed after a deposit or registration-only payment. Registration fees are left out. */
export async function paymentBalanceFor(userId: number, cohort: Cohort, currency: string): Promise<PaymentBalance> {
  const db = await getDb();
  const paidRows = await db.select().from(payments).where(and(eq(payments.userId, userId), eq(payments.cohortId, cohort.id), eq(payments.currency, currency), eq(payments.status, "paid")));
  const deposit = paidRows.find((payment) => PART_PAYMENT_PLANS.includes(payment.paymentPlan));
  let total = deposit?.originalAmount ?? cohort.prices[currency] ?? 0;
  if (deposit?.discountCodeId) {
    const [discount] = await db.select().from(discountCodes).where(eq(discountCodes.id, deposit.discountCodeId));
    if (discount) total = Math.round(total * (100 - discount.percentOff) / 100);
  }
  const paid = paidRows.reduce((sum, payment) => sum + payment.amount - payment.registrationFee, 0);
  return { total, paid, remaining: Math.max(0, total - paid), currency };
}

/** Starts checkout for the exact unpaid amount, preserving any discount used on the deposit. */
export async function startBalanceCheckout(user: User, course: Course, cohort: Cohort, currency: string): Promise<{ url: string } | { error: string }> {
  const balance = await paymentBalanceFor(user.id, cohort, currency);
  if (!balance.total) return { error: "This cohort isn't sold in that currency." };
  const [started] = await (await getDb()).select({ id: payments.id }).from(payments).where(and(eq(payments.userId, user.id), eq(payments.cohortId, cohort.id), eq(payments.currency, currency), eq(payments.status, "paid")));
  if (!started) return { error: "No deposit or previous payment was found for this cohort." };
  if (!balance.remaining) return { error: "This cohort has already been paid in full." };
  const db = await getDb();
  await db.update(payments).set({ status: "failed" }).where(and(eq(payments.userId, user.id), eq(payments.cohortId, cohort.id), eq(payments.currency, currency), eq(payments.paymentPlan, "balance"), eq(payments.status, "pending")));
  // Card where it's available, otherwise mobile money from the country of the student's phone number.
  const method: PayMethod = (await payableMethods()).card.includes(currency) ? "card" : "mobile";
  return beginOnlinePayment(user, course, cohort, currency, {
    method,
    country: MOBILE_MONEY_DIAL[user.phone.split(" ")[0]],
    amount: balance.remaining,
    originalAmount: balance.total,
    paymentPlan: "balance",
    description: `${describePurchase(course, cohort)} (remaining balance)`,
  });
}

/**
 * Creates a pending bank-transfer payment. The student sees the account details and a reference;
 * an admin confirms it under Payments once the money arrives.
 */
export async function startBankTransfer(user: User, course: Course, cohort: Cohort, plan: EnrolPlan = "full"): Promise<{ url: string; reference: string } | { error: string }> {
  const bank = await bankTransferConfig();
  if (!bank.enabled) return { error: "Bank transfer isn't available." };
  const q = quote(cohort, bank.currency, plan);
  if (!q.dueNow) return { error: `This cohort has no ${bank.currency} price for bank transfer.` };
  const paymentPlan = q.later > 0 ? plan : "full";
  const db = await getDb();
  // Reuse an open transfer for the same cohort and amount rather than creating duplicates.
  const open = await db.select().from(payments).where(and(eq(payments.userId, user.id), eq(payments.cohortId, cohort.id), eq(payments.gateway, "manual"), eq(payments.status, "pending")));
  const same = open.find((p) => p.amount === q.dueNow && p.paymentPlan === paymentPlan);
  if (same) return { url: `/checkout/transfer?ref=${same.reference}`, reference: same.reference };
  if (open.length) await db.update(payments).set({ status: "failed" }).where(inArray(payments.id, open.map((p) => p.id)));
  const reference = newReference();
  const description = `${describePurchase(course, cohort)}${planNote(paymentPlan, cohort, q.registrationFee)}`;
  await db.insert(payments).values({ reference, userId: user.id, cohortId: cohort.id, gateway: "manual", amount: q.dueNow, currency: bank.currency, description, originalAmount: q.tuitionPrice, paymentPlan, registrationFee: q.registrationFee });
  await notify((await getAdmins()).map((a) => a.id), {
    kind: "payment",
    title: `Bank transfer expected: ${formatMoney(q.dueNow, bank.currency)}`,
    body: `${user.name} chose bank transfer for ${description} (ref ${reference}).`,
    href: "/admin/payments?status=pending",
  });
  return { url: `/checkout/transfer?ref=${reference}`, reference };
}

/** Asks the gateway whether a payment succeeded and fulfils it if so. Returns the latest payment row. */
export async function verifyPayment(reference: string): Promise<Payment | null> {
  const db = await getDb();
  const [payment] = await db.select().from(payments).where(eq(payments.reference, reference));
  if (!payment || payment.status === "paid") return payment ?? null;

  try {
    const cfg = payment.gateway === "stripe" || payment.gateway === "paystack" || payment.gateway === "pawapay" ? await gatewayConfig(payment.gateway) : null;
    if (payment.gateway === "stripe" && payment.providerId && cfg?.secretKey) {
      const session = await stripe(cfg.secretKey).checkout.sessions.retrieve(payment.providerId);
      if (session.payment_status === "paid" && session.amount_total === payment.amount && session.currency?.toUpperCase() === payment.currency) {
        await fulfilPayment(reference);
      }
    } else if (payment.gateway === "pawapay" && payment.providerId && cfg?.secretKey) {
      const found = await pawapay<{ status: "FOUND" | "NOT_FOUND"; data?: { status: string; amount: string; currency: string } }>(cfg, `/v2/deposits/${encodeURIComponent(payment.providerId)}`);
      const deposit = found.status === "FOUND" ? found.data : undefined;
      if (deposit?.status === "COMPLETED" && Math.round(Number(deposit.amount) * 100) === payment.amount && deposit.currency === payment.currency) {
        await fulfilPayment(reference);
      } else if (deposit?.status === "FAILED" || (!deposit && Date.now() - new Date(payment.createdAt).getTime() > 20 * 60_000)) {
        // A deposit pawaPay never saw means the payment page expired (after 15 minutes) unused.
        await db.update(payments).set({ status: "failed" }).where(and(eq(payments.reference, reference), eq(payments.status, "pending")));
      }
    } else if (payment.gateway === "paystack" && cfg?.secretKey) {
      const data = await paystack<{ status: string; amount: number; currency: string }>(cfg.secretKey, `/transaction/verify/${encodeURIComponent(reference)}`);
      if (data.status === "success" && data.amount === payment.amount && data.currency === payment.currency) {
        await fulfilPayment(reference);
      } else if (data.status === "failed" || data.status === "abandoned") {
        await db.update(payments).set({ status: "failed" }).where(and(eq(payments.reference, reference), eq(payments.status, "pending")));
      }
    }
  } catch (error) {
    console.error("Payment verification failed", reference, error);
  }
  const [latest] = await db.select().from(payments).where(eq(payments.reference, reference));
  return latest ?? null;
}

/** Gives the student their place on the cohort, notifies them and emails confirmation. */
export async function activateEnrollment(userId: number, cohortId: number, source: EnrollmentSource): Promise<boolean> {
  const db = await getDb();
  const [existing] = await db.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.cohortId, cohortId)));
  if (existing && ["active", "completed"].includes(existing.status)) return false;
  if (existing) {
    await db.update(enrollments).set({ status: "active", source, activatedAt: new Date() }).where(eq(enrollments.id, existing.id));
  } else {
    await db.insert(enrollments).values({ userId, cohortId, status: "active", source, activatedAt: new Date() });
  }

  const found = await getCohortWithCourse(cohortId);
  if (!found) return true;
  const { cohort, course } = found;
  // Accounts are created at enrolment without a password; the student sets one from this email.
  const [student] = await db.select().from(users).where(eq(users.id, userId));
  if (student && !student.passwordHash) {
    const token = await issueToken(student.id, "invite");
    await sendEmails([{ to: student.email, template: "account_setup", vars: { name: firstName(student.name), courseTitle: course.title, setupUrl: absoluteUrl(`/reset-password?token=${token}`) } }]);
  }
  await notify([userId], {
    kind: "enrollment",
    title: `You're enrolled on ${course.title}`,
    body: `${cohort.name}${cohort.startDate ? `, starting ${formatDateOnly(cohort.startDate)}` : ""}.`,
    href: `/dashboard/cohorts/${cohortId}`,
    email: {
      template: "enrollment_confirmed",
      vars: {
        courseTitle: course.title,
        cohortName: cohort.name,
        startDate: formatDateOnly(cohort.startDate) || "To be confirmed",
        deliveryMode: MODE_LABEL[cohort.deliveryMode],
        dashboardUrl: absoluteUrl(`/dashboard/cohorts/${cohortId}`),
      },
    },
  });
  return true;
}

/**
 * Marks a payment paid exactly once (webhooks and the return page can race) and enrols the student.
 * Safe to call repeatedly.
 */
export async function fulfilPayment(reference: string): Promise<void> {
  const db = await getDb();
  const [payment] = await db
    .update(payments)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(payments.reference, reference), inArray(payments.status, ["pending", "failed"])))
    .returning();
  if (!payment) return;

  if (payment.discountCodeId) await db.update(discountCodes).set({ usedCount: sql`${discountCodes.usedCount} + 1` }).where(eq(discountCodes.id, payment.discountCodeId));

  const [user] = await db.select().from(users).where(eq(users.id, payment.userId));
  if (!user) return;
  const settings = await getSettings();
  const amount = formatMoney(payment.amount, payment.currency);

  await sendEmails([{
    to: user.email,
    template: "payment_receipt",
    vars: {
      name: firstName(user.name),
      amount,
      reference: payment.reference,
      description: payment.description,
      paidAt: new Intl.DateTimeFormat("en-GB", { timeZone: settings.timezone, day: "numeric", month: "short", year: "numeric" }).format(payment.paidAt ?? new Date()),
      gateway: { stripe: "Card (Stripe)", paystack: "Paystack", pawapay: "Mobile money (pawaPay)", manual: "Recorded by the academy", test: "Test payment" }[payment.gateway],
      paymentsUrl: absoluteUrl("/dashboard/payments"),
    },
  }]);

  if (payment.cohortId) await activateEnrollment(payment.userId, payment.cohortId, "payment");

  await notify((await getAdmins()).map((a) => a.id), {
    kind: "payment",
    title: `Payment received: ${amount}`,
    body: `${user.name} paid for ${payment.description}.`,
    href: "/admin/payments",
  });
}
