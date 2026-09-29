/**
 * Countries students can register from: dialling code, the currency they pay in (when the academy
 * sells in it) and, for mobile money markets, the ISO alpha-3 code pawaPay uses. Shared by the
 * phone field, enrolment and local pricing, so they always agree.
 */
export type Country = {
  code: string;
  name: string;
  dial: string;
  example?: string;
  /** The local currency, when it's one the academy can sell in. */
  currency?: string;
  /** pawaPay's country code, for mobile money markets. */
  iso3?: string;
};

export const COUNTRIES: Country[] = [
  { code: "AT", name: "Austria", dial: "+43", currency: "EUR" },
  { code: "AU", name: "Australia", dial: "+61", example: "0412 345 678" },
  { code: "BE", name: "Belgium", dial: "+32", currency: "EUR" },
  { code: "BF", name: "Burkina Faso", dial: "+226", example: "70 12 34 56", currency: "XOF", iso3: "BFA" },
  { code: "BJ", name: "Benin", dial: "+229", example: "01 90 12 34 56", currency: "XOF", iso3: "BEN" },
  { code: "CA", name: "Canada", dial: "+1", example: "(506) 234-5678", currency: "CAD" },
  { code: "CF", name: "Central African Republic", dial: "+236", currency: "XAF" },
  { code: "CG", name: "Republic of the Congo", dial: "+242", example: "06 612 3456", currency: "XAF", iso3: "COG" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225", example: "01 23 45 67 89", currency: "XOF", iso3: "CIV" },
  { code: "CM", name: "Cameroon", dial: "+237", example: "6 71 23 45 67", currency: "XAF", iso3: "CMR" },
  { code: "CY", name: "Cyprus", dial: "+357", currency: "EUR" },
  { code: "DE", name: "Germany", dial: "+49", example: "01512 3456789", currency: "EUR" },
  { code: "DK", name: "Denmark", dial: "+45" },
  { code: "EE", name: "Estonia", dial: "+372", currency: "EUR" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "ES", name: "Spain", dial: "+34", currency: "EUR" },
  { code: "ET", name: "Ethiopia", dial: "+251" },
  { code: "FI", name: "Finland", dial: "+358", currency: "EUR" },
  { code: "FR", name: "France", dial: "+33", example: "06 12 34 56 78", currency: "EUR" },
  { code: "GA", name: "Gabon", dial: "+241", example: "06 03 12 34", currency: "XAF", iso3: "GAB" },
  { code: "GB", name: "United Kingdom", dial: "+44", example: "07400 123456", currency: "GBP" },
  { code: "GH", name: "Ghana", dial: "+233", example: "023 123 4567", currency: "GHS", iso3: "GHA" },
  { code: "GM", name: "Gambia", dial: "+220" },
  { code: "GQ", name: "Equatorial Guinea", dial: "+240", currency: "XAF" },
  { code: "GR", name: "Greece", dial: "+30", currency: "EUR" },
  { code: "GW", name: "Guinea-Bissau", dial: "+245", currency: "XOF" },
  { code: "HR", name: "Croatia", dial: "+385", currency: "EUR" },
  { code: "IE", name: "Ireland", dial: "+353", example: "085 012 3456", currency: "EUR" },
  { code: "IN", name: "India", dial: "+91", example: "081234 56789" },
  { code: "IT", name: "Italy", dial: "+39", currency: "EUR" },
  { code: "KE", name: "Kenya", dial: "+254", example: "0712 123456", currency: "KES", iso3: "KEN" },
  { code: "LR", name: "Liberia", dial: "+231" },
  { code: "LT", name: "Lithuania", dial: "+370", currency: "EUR" },
  { code: "LU", name: "Luxembourg", dial: "+352", currency: "EUR" },
  { code: "LV", name: "Latvia", dial: "+371", currency: "EUR" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "ML", name: "Mali", dial: "+223", currency: "XOF" },
  { code: "MT", name: "Malta", dial: "+356", currency: "EUR" },
  { code: "MW", name: "Malawi", dial: "+265" },
  { code: "NE", name: "Niger", dial: "+227", currency: "XOF" },
  { code: "NG", name: "Nigeria", dial: "+234", example: "0803 123 4567", currency: "NGN", iso3: "NGA" },
  { code: "NL", name: "Netherlands", dial: "+31", currency: "EUR" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "PT", name: "Portugal", dial: "+351", currency: "EUR" },
  { code: "QA", name: "Qatar", dial: "+974" },
  { code: "RW", name: "Rwanda", dial: "+250", example: "0788 123 456", currency: "RWF", iso3: "RWA" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "SI", name: "Slovenia", dial: "+386", currency: "EUR" },
  { code: "SK", name: "Slovakia", dial: "+421", currency: "EUR" },
  { code: "SL", name: "Sierra Leone", dial: "+232" },
  { code: "SN", name: "Senegal", dial: "+221", example: "77 123 45 67", currency: "XOF", iso3: "SEN" },
  { code: "TD", name: "Chad", dial: "+235", currency: "XAF" },
  { code: "TG", name: "Togo", dial: "+228", currency: "XOF" },
  { code: "TZ", name: "Tanzania", dial: "+255", example: "0712 345 678", currency: "TZS", iso3: "TZA" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", example: "050 123 4567" },
  { code: "UG", name: "Uganda", dial: "+256", example: "0772 123456", currency: "UGX", iso3: "UGA" },
  { code: "US", name: "United States", dial: "+1", example: "(201) 555-0123", currency: "USD" },
  { code: "ZA", name: "South Africa", dial: "+27", example: "071 123 4567", currency: "ZAR" },
  { code: "ZM", name: "Zambia", dial: "+260" },
].sort((a, b) => a.name.localeCompare(b.name));

export function countryByCode(code: string | null | undefined): Country | undefined {
  return code ? COUNTRIES.find((c) => c.code === code.toUpperCase()) : undefined;
}

const WITH_THE = new Set(["GB", "US", "AE", "NL", "CF", "CG", "GM"]);

/** The name as it reads in a sentence: "the United Kingdom", "Nigeria". */
export function countryInSentence(code: string | null | undefined): string | undefined {
  const country = countryByCode(code);
  return country && (WITH_THE.has(country.code) ? `the ${country.name}` : country.name);
}

/** 🇳🇬 from "NG". */
export function flag(code: string): string {
  return String.fromCodePoint(...code.toUpperCase().split("").map((ch) => 127397 + ch.charCodeAt(0)));
}

/** The currency a student in this country pays in, when the academy sells in it. */
export function currencyForCountry(code: string | null | undefined): string | undefined {
  return countryByCode(code)?.currency;
}

/** pawaPay's country code for a phone dialling code, e.g. "+234" → "NGA". Shared codes (like +1) match the first country. */
export function mobileMoneyCountryForDial(dial: string): string | undefined {
  return COUNTRIES.find((c) => c.dial === dial && c.iso3)?.iso3;
}
