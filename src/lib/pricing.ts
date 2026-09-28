import type { Cohort, PaymentPlan } from "@/db/schema";

/** Plans a student can choose when they enrol; "balance" is only for paying the rest later. */
export type EnrolPlan = Exclude<PaymentPlan, "balance">;

type PricedCohort = Pick<Cohort, "prices" | "registrationFees" | "depositPercent" | "registrationOnly">;

export type Quote = {
  /** Tuition before any discount. */
  tuitionPrice: number;
  /** Tuition after the discount. */
  tuition: number;
  registrationFee: number;
  /** Tuition charged in the first payment. */
  tuitionNow: number;
  /** What the student pays today: registration fee plus tuitionNow. */
  dueNow: number;
  /** Tuition left to pay after today. */
  later: number;
  total: number;
};

/** Plans offered for a cohort in a currency, in display order. */
export function availablePlans(cohort: PricedCohort, currency: string): EnrolPlan[] {
  const tuition = cohort.prices[currency] ?? 0;
  const fee = cohort.registrationFees[currency] ?? 0;
  const plans: EnrolPlan[] = ["full"];
  if (tuition > 0 && cohort.depositPercent) plans.push("deposit");
  if (tuition > 0 && fee > 0 && cohort.registrationOnly) plans.push("registration");
  return plans;
}

/** Amounts for enrolling on a cohort. Discounts apply to tuition, never to the registration fee. */
export function quote(cohort: PricedCohort, currency: string, plan: EnrolPlan, percentOff = 0): Quote {
  const tuitionPrice = cohort.prices[currency] ?? 0;
  const tuition = Math.round(tuitionPrice * (100 - percentOff) / 100);
  const registrationFee = cohort.registrationFees[currency] ?? 0;
  const chosen = availablePlans(cohort, currency).includes(plan) ? plan : "full";
  const tuitionNow = chosen === "registration" ? 0 : chosen === "deposit" ? Math.max(1, Math.round(tuition * cohort.depositPercent! / 100)) : tuition;
  return { tuitionPrice, tuition, registrationFee, tuitionNow, dueNow: registrationFee + tuitionNow, later: tuition - tuitionNow, total: tuition + registrationFee };
}

/** Currencies a cohort can be bought in: those with tuition or a registration fee. */
export function cohortCurrencies(cohort: PricedCohort): string[] {
  return [...new Set([...Object.keys(cohort.prices), ...Object.keys(cohort.registrationFees)])].filter((c) => (cohort.prices[c] ?? 0) > 0 || (cohort.registrationFees[c] ?? 0) > 0);
}

export const PLAN_LABEL: Record<PaymentPlan, string> = { full: "Full payment", deposit: "Deposit", registration: "Registration fee only", balance: "Balance" };

/** Payments that leave tuition to be paid later. */
export const PART_PAYMENT_PLANS: PaymentPlan[] = ["deposit", "registration"];
