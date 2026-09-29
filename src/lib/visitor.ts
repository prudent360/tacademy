import "server-only";
import { headers } from "next/headers";
import type { Settings } from "@/db/schema";
import { currencyForCountry } from "./countries";

/** The visitor's country from Vercel's edge network; null locally or when it can't be told. */
export async function visitorCountry(): Promise<string | null> {
  const code = (await headers()).get("x-vercel-ip-country")?.toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * The academy's currencies in the order to show them to this visitor: their local currency first
 * when the academy accepts it, then the order set in Settings. Pages fall back along this list when
 * a cohort has no price in the local currency.
 */
export async function visitorCurrencies(settings: Pick<Settings, "currencies">): Promise<{ currencies: string[]; country: string | null }> {
  const country = await visitorCountry();
  const local = currencyForCountry(country);
  const currencies = local && settings.currencies.includes(local) ? [local, ...settings.currencies.filter((c) => c !== local)] : settings.currencies;
  return { currencies, country };
}
