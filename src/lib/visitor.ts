import "server-only";
import { headers } from "next/headers";
import type { Settings } from "@/db/schema";

const EURO = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"];
const XOF = ["SN", "CI", "BJ", "BF", "ML", "NE", "TG", "GW"];
const XAF = ["CM", "CG", "GA", "TD", "CF", "GQ"];

/** Country (ISO 3166 alpha-2) → the currency a visitor there pays in. */
const COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR", UG: "UGX", TZ: "TZS", RW: "RWF", GB: "GBP", US: "USD", CA: "CAD",
  ...Object.fromEntries(EURO.map((c) => [c, "EUR"])),
  ...Object.fromEntries(XOF.map((c) => [c, "XOF"])),
  ...Object.fromEntries(XAF.map((c) => [c, "XAF"])),
};

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
  const local = country ? COUNTRY_CURRENCY[country] : undefined;
  const currencies = local && settings.currencies.includes(local) ? [local, ...settings.currencies.filter((c) => c !== local)] : settings.currencies;
  return { currencies, country };
}
