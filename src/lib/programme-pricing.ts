import type { Programme } from "@/db/schema";

export type InstalmentPlan = { count: number; first: number; rest: number };

/**
 * Splits a fee (minor units) into monthly instalments: the first is `firstPercent` of the fee (or an equal share),
 * the others equal. Later instalments are rounded down to whole units and the first takes the remainder, so the
 * parts always add up to the fee exactly.
 */
export function instalmentPlan(total: number, count: number | null, firstPercent: number | null): InstalmentPlan | null {
  if (!count || count < 2 || total <= 0) return null;
  const firstTarget = firstPercent ? total * firstPercent / 100 : total / count;
  const rest = Math.floor((total - firstTarget) / (count - 1) / 100) * 100;
  return { count, first: total - rest * (count - 1), rest };
}

/** "Data Career Programme" stays as it is; "Data Analytics" becomes "Data Analytics programme". */
export function programmeName(title: string): string {
  return /\bprogram(me)?$/i.test(title.trim()) ? title.trim() : `${title.trim()} programme`;
}

export type ProgrammePlan = "full" | "instalments";

export type ProgrammeQuote = {
  /** The fee before and after any discount. */
  fee: number;
  total: number;
  count: number;
  first: number;
  rest: number;
};

/** What the student pays for a programme in a currency, in full or by instalments, with a discount applied to the whole fee. */
export function programmeQuote(programme: Pick<Programme, "prices" | "instalmentCount" | "instalmentFirstPercent">, currency: string, plan: ProgrammePlan, percentOff = 0): ProgrammeQuote | null {
  const fee = programme.prices[currency] ?? 0;
  if (fee <= 0) return null;
  const total = Math.round(fee * (100 - percentOff) / 100);
  const split = plan === "instalments" ? instalmentPlan(total, programme.instalmentCount, programme.instalmentFirstPercent) : null;
  return split ? { fee, total, ...split } : { fee, total, count: 1, first: total, rest: 0 };
}
