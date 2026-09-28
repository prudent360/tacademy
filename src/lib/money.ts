export type CurrencyInfo = {
  code: string;
  name: string;
  /** The gateway for "Pay online". */
  gateway: "stripe" | "paystack" | "pawapay";
  /** Countries (ISO 3166 alpha-3) where pawaPay takes mobile money in this currency. */
  mobileMoney?: string[];
};

/** Stripe takes cards; Paystack settles the larger African currencies; pawaPay takes mobile money. */
export const CURRENCIES: CurrencyInfo[] = [
  { code: "GBP", name: "British pound", gateway: "stripe" },
  { code: "USD", name: "US dollar", gateway: "stripe" },
  { code: "EUR", name: "Euro", gateway: "stripe" },
  { code: "CAD", name: "Canadian dollar", gateway: "stripe" },
  { code: "NGN", name: "Nigerian naira", gateway: "paystack", mobileMoney: ["NGA"] },
  { code: "GHS", name: "Ghanaian cedi", gateway: "paystack", mobileMoney: ["GHA"] },
  { code: "KES", name: "Kenyan shilling", gateway: "paystack", mobileMoney: ["KEN"] },
  { code: "ZAR", name: "South African rand", gateway: "paystack" },
  { code: "UGX", name: "Ugandan shilling", gateway: "pawapay", mobileMoney: ["UGA"] },
  { code: "TZS", name: "Tanzanian shilling", gateway: "pawapay", mobileMoney: ["TZA"] },
  { code: "RWF", name: "Rwandan franc", gateway: "pawapay", mobileMoney: ["RWA"] },
  { code: "XOF", name: "West African CFA franc", gateway: "pawapay", mobileMoney: ["SEN", "CIV", "BEN", "BFA"] },
  { code: "XAF", name: "Central African CFA franc", gateway: "pawapay", mobileMoney: ["CMR", "COG", "GAB"] },
];

export const MOBILE_MONEY_COUNTRIES: Record<string, string> = {
  NGA: "Nigeria", GHA: "Ghana", KEN: "Kenya", UGA: "Uganda", TZA: "Tanzania", RWA: "Rwanda",
  SEN: "Senegal", CIV: "Côte d'Ivoire", BEN: "Benin", BFA: "Burkina Faso", CMR: "Cameroon", COG: "Republic of the Congo", GAB: "Gabon",
};

/** Phone dial code → mobile money country, to preselect where the student's wallet is. */
export const MOBILE_MONEY_DIAL: Record<string, string> = {
  "+234": "NGA", "+233": "GHA", "+254": "KEN", "+256": "UGA", "+255": "TZA", "+250": "RWA",
  "+221": "SEN", "+225": "CIV", "+229": "BEN", "+226": "BFA", "+237": "CMR", "+242": "COG", "+241": "GAB",
};

/** Countries a currency can be paid from by mobile money; empty when pawaPay doesn't cover it. */
export function mobileMoneyCountries(currency: string): string[] {
  return currencyInfo(currency)?.mobileMoney ?? [];
}

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function currencyInfo(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function gatewayFor(currency: string): CurrencyInfo["gateway"] {
  return currencyInfo(currency)?.gateway ?? "stripe";
}

/** Formats minor units: formatMoney(49900, "GBP") -> "£499". */
export function formatMoney(minor: number, currency: string): string {
  const major = minor / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/** Parses "499" or "1,250.50" into minor units; null when empty or invalid. */
export function parseMajor(value: string): number | null {
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN;
  return Math.round(Number(cleaned) * 100);
}

export function toMajorInput(minor: number | undefined): string {
  if (minor === undefined) return "";
  const major = minor / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}
