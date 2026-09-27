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

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export const MODE_LABEL = { virtual: "Live online", physical: "In person", hybrid: "Hybrid" } as const;
