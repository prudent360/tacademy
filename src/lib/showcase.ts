import type { ShowcaseStatus } from "@/db/schema";

export const SHOWCASE_STATUS_LABEL: Record<ShowcaseStatus, string> = { invited: "Invited", published: "Published", declined: "Declined", hidden: "Hidden by the team" };
export const SHOWCASE_STATUS_TONE: Record<ShowcaseStatus, "accent" | "green" | "neutral" | "amber"> = { invited: "accent", published: "green", declined: "neutral", hidden: "amber" };

/** "Power BI, SQL , DAX" → ["Power BI", "SQL", "DAX"]: trimmed, de-duplicated, at most 8. */
export function parseTools(value: FormDataEntryValue | null): string[] {
  const seen = new Set<string>();
  return String(value ?? "").split(",").map((t) => t.trim().slice(0, 40)).filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 8);
}
