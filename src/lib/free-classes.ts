import type { FreeClass, FreeClassStatus } from "@/db/schema";
import { MODE_LABEL } from "./utils";

export const FREE_CLASS_STATUS_LABEL: Record<FreeClassStatus, string> = { draft: "Draft", open: "Open", closed: "Closed" };
export const FREE_CLASS_STATUS_TONE: Record<FreeClassStatus, "neutral" | "green" | "amber"> = { draft: "neutral", open: "green", closed: "amber" };

/** Seats left, or null when there's no limit. */
export function seatsLeft(fc: Pick<FreeClass, "capacity">, taken: number): number | null {
  return fc.capacity ? Math.max(0, fc.capacity - taken) : null;
}

/** Open, not started yet, and not full. */
export function acceptingSignups(fc: Pick<FreeClass, "status" | "startsAt" | "capacity">, taken: number, now = new Date()): boolean {
  return fc.status === "open" && new Date(fc.startsAt) > now && seatsLeft(fc, taken) !== 0;
}

/** Where to join, for emails to people who signed up: the meeting link online, the venue in person. */
export function joinLine(fc: Pick<FreeClass, "mode" | "meetingUrl" | "venue">): string {
  return fc.mode === "virtual"
    ? (fc.meetingUrl ? `**Join link:** ${fc.meetingUrl}` : "We'll email you the joining link before the class.")
    : `**Venue:** ${fc.venue || "We'll email you the address before the class."}`;
}

export const freeClassModeLabel = (fc: Pick<FreeClass, "mode">) => MODE_LABEL[fc.mode];
