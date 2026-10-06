import type { ClassSession } from "@/db/schema";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Builds an iCalendar file so students can add classes to Google, Apple or Outlook calendars. */
export function buildIcs(events: { session: ClassSession; courseTitle: string; url: string }[], calendarName: string): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Academy//Classes//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escape(calendarName)}`];
  for (const { session, courseTitle, url } of events) {
    const location = session.mode === "virtual" ? session.meetingUrl ?? "Online" : session.venue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:session-${session.id}@academy`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(new Date(session.startsAt))}`,
      `DTEND:${stamp(new Date(session.endsAt))}`,
      `SUMMARY:${escape(`${session.title} (${courseTitle})`)}`,
      `DESCRIPTION:${escape([session.description, url].filter(Boolean).join("\n\n"))}`,
      `LOCATION:${escape(location || "")}`,
      `URL:${url}`,
      session.cancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** A one-event calendar file, e.g. for a free class someone signed up to. */
export function buildEventIcs(event: { uid: string; title: string; description: string; startsAt: Date; endsAt: Date; location: string; url: string }, calendarName: string): string {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Academy//Classes//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escape(calendarName)}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}@academy`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(event.endsAt)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape([event.description, event.url].filter(Boolean).join("\n\n"))}`,
    `LOCATION:${escape(event.location)}`,
    `URL:${event.url}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
