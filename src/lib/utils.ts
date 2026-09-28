export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Splits a comma or newline separated list into trimmed, non-empty entries. */
export function parseList(value: FormDataEntryValue | null, separator: RegExp = /[,\n]/): string[] {
  if (typeof value !== "string") return [];
  return value.split(separator).map((item) => item.trim()).filter(Boolean);
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n.charAt(0)).join("").toUpperCase() || "?";
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Student ID, e.g. TSU26-0042: the year the account was created and its number. Derived rather
 * than stored, so every account has one and it never changes.
 */
export function studentId(user: { id: number; createdAt: Date | string }): string {
  return `TSU${String(new Date(user.createdAt).getUTCFullYear()).slice(2)}-${String(user.id).padStart(4, "0")}`;
}

/** The account number in a student ID ("TSU26-0042", "tsu260042"), or null when it isn't one. */
export function parseStudentId(value: string): number | null {
  const match = value.trim().match(/^TSU\d{2}-?(\d{1,9})$/i);
  return match ? Number(match[1]) : null;
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export const MODE_LABEL = { virtual: "Live online", physical: "In person", hybrid: "Hybrid" } as const;

/** Options for "Highest academic qualification" on the enrolment form. */
export const QUALIFICATIONS = ["Secondary school (SSCE / WAEC / GCSE)", "OND / NCE / A-levels", "HND", "Bachelor's degree", "Master's degree", "PhD / Doctorate", "Other"] as const;
