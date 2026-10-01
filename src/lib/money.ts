export type CurrencyInfo = {
  code: string;
  name: string;
  /** The gateway for "Pay online". TransactPay-only currencies can be paid only when the TransactPay account takes them. */
  gateway: "stripe" | "paystack" | "transactpay";
};

/** Stripe takes the international currencies; Paystack the larger African ones; the rest only through TransactPay. */
export const CURRENCIES: CurrencyInfo[] = [
  { code: "GBP", name: "British pound", gateway: "stripe" },
  { code: "USD", name: "US dollar", gateway: "stripe" },
  { code: "EUR", name: "Euro", gateway: "stripe" },
  { code: "CAD", name: "Canadian dollar", gateway: "stripe" },
  { code: "NGN", name: "Nigerian naira", gateway: "paystack" },
  { code: "GHS", name: "Ghanaian cedi", gateway: "paystack" },
  { code: "KES", name: "Kenyan shilling", gateway: "paystack" },
  { code: "ZAR", name: "South African rand", gateway: "paystack" },
  { code: "UGX", name: "Ugandan shilling", gateway: "transactpay" },
  { code: "TZS", name: "Tanzanian shilling", gateway: "transactpay" },
  { code: "RWF", name: "Rwandan franc", gateway: "transactpay" },
  { code: "XOF", name: "West African CFA franc", gateway: "transactpay" },
  { code: "XAF", name: "Central African CFA franc", gateway: "transactpay" },
];

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
