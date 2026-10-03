import { CalendarIcon, PinIcon, VideoIcon } from "@/components/icons";
import { Badge, ModeBadge } from "@/components/ui";
import type { AttendanceStatus, ClassSession } from "@/db/schema";
import { formatDayMonth, formatSessionRange } from "@/lib/time";

/** One class in a timetable: when, where, and how to join. */
export function SessionRow({ session, timeZone, courseTitle, attendance, now = new Date(), showActions = true, children }: {
  session: ClassSession;
  timeZone: string;
  courseTitle?: string;
  attendance?: AttendanceStatus;
  now?: Date;
  showActions?: boolean;
  children?: React.ReactNode;
}) {
  const start = new Date(session.startsAt).getTime();
  const end = new Date(session.endsAt).getTime();
  const live = now.getTime() >= start - 15 * 60_000 && now.getTime() <= end;
  const past = now.getTime() > end;
  const { day, month, weekday } = formatDayMonth(session.startsAt, timeZone);

  return (
    <li className={`flex flex-wrap items-start gap-4 py-4 sm:flex-nowrap ${session.cancelled ? "opacity-60" : ""}`}>
      <div className={`flex w-14 shrink-0 flex-col items-center rounded-xl py-2 ${past ? "bg-page text-muted" : "bg-accent-soft text-accent-ink"}`}>
        <span className="font-mono text-[10px] uppercase tracking-wider">{weekday}</span>
        <span className="font-display text-xl font-bold leading-tight">{day}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider">{month}</span>
      </div>
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`font-display text-[17px] font-bold text-ink ${session.cancelled ? "line-through" : ""}`}>{session.title}</p>
          <ModeBadge mode={session.mode} />
          {session.cancelled && <Badge tone="red">Cancelled</Badge>}
          {live && !session.cancelled && <Badge tone="green">Happening now</Badge>}
          {attendance && <Badge tone={attendance === "present" ? "green" : attendance === "late" ? "amber" : attendance === "absent" ? "red" : "neutral"}>{attendance.charAt(0).toUpperCase() + attendance.slice(1)}</Badge>}
        </div>
        <p className="text-sm text-muted">{courseTitle ? `${courseTitle} · ` : ""}{formatSessionRange(session.startsAt, session.endsAt, timeZone)}</p>
        {session.mode === "physical" && session.venue && (
          <p className="flex items-start gap-1.5 text-sm text-body"><PinIcon className="mt-0.5 size-4 shrink-0 text-cyan" /> {session.venue}</p>
        )}
        {session.description && <p className="text-sm leading-relaxed text-body">{session.description}</p>}
        {children}
      </div>
      {showActions && !session.cancelled && (
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
          {session.mode === "virtual" && session.meetingUrl && !past && (
            <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold ${live ? "bg-accent text-white hover:bg-accent-dark" : "border border-edge-strong bg-surface text-ink hover:bg-page"}`}>
              <VideoIcon className="size-4" /> {live ? "Join now" : "Joining link"}
            </a>
          )}
          {session.mode === "physical" && session.venue && !past && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.venue)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-edge-strong bg-surface px-3.5 text-sm font-semibold text-ink hover:bg-page">
              <PinIcon className="size-4" /> Directions
            </a>
          )}
          {past && session.recordingUrl && (
            <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-edge-strong bg-surface px-3.5 text-sm font-semibold text-ink hover:bg-page">
              <VideoIcon className="size-4" /> Recording
            </a>
          )}
          {!past && (
            <a href={`/api/sessions/${session.id}/ics`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-accent-ink hover:bg-accent-soft">
              <CalendarIcon className="size-4" /> Add to calendar
            </a>
          )}
        </div>
      )}
    </li>
  );
}
