/**
 * Class times are stored in UTC and shown in the academy's timezone (Settings > timezone),
 * so a London class reads the same for every student wherever they are.
 */

function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-10-06T18:00" in the given zone -> Date. */
export function fromZonedInput(value: string, timeZone: string): Date {
  const [d, t] = value.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = (t ?? "00:00").split(":").map(Number);
  const naive = Date.UTC(y, m - 1, day, h, min);
  const first = naive - offsetMs(new Date(naive), timeZone);
  return new Date(naive - offsetMs(new Date(first), timeZone));
}

/** Date -> "2026-10-06T18:00" in the given zone, for datetime-local inputs. */
export function toZonedInput(date: Date | null | undefined, timeZone: string): string {
  if (!date) return "";
  const shifted = new Date(new Date(date).getTime() + offsetMs(new Date(date), timeZone));
  return shifted.toISOString().slice(0, 16);
}

export function formatDateTime(date: Date | string, timeZone: string, opts: { zone?: boolean } = { zone: true }): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZoneName: opts.zone ? "short" : undefined,
  }).format(new Date(date));
}

export function formatTime(date: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

export function formatDayMonth(date: Date | string, timeZone: string): { day: string; month: string; weekday: string } {
  const d = new Date(date);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone, ...o }).format(d);
  return { day: f({ day: "numeric" }), month: f({ month: "short" }), weekday: f({ weekday: "short" }) };
}

/** "Mon 6 Oct, 18:00 – 20:00 BST" */
export function formatSessionRange(start: Date | string, end: Date | string, timeZone: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(s);
  const zone = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" }).formatToParts(s).find((p) => p.type === "timeZoneName")?.value;
  return `${day}, ${formatTime(s, timeZone)} – ${formatTime(e, timeZone)}${zone ? ` ${zone}` : ""}`;
}

/** "6 Oct 2026" from a YYYY-MM-DD string. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

export function relativeTime(date: Date | string, now = new Date()): string {
  const diff = new Date(date).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

/** "Good morning" etc. in the academy's timezone. */
export function greeting(timeZone: string, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Short "in 3h", "in 2 days", "2h ago" style label for dashboards. */
export function untilLabel(date: Date | string, now = new Date()): string {
  const diff = new Date(date).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const text = mins < 60 ? `${mins} min` : mins < 48 * 60 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)} days`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

/** Start of the current week (Monday 00:00 UTC) and a week later. */
export function thisWeek(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
}
