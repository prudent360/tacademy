import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarIcon, ClipboardIcon, MegaphoneIcon, PinIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { SessionRow } from "@/components/portal/session-row";
import { Avatar, Badge, Card, ModeBadge, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCohortWithCourse, getInstructorsByCohort, getSettings, isEnrolled } from "@/lib/data";
import { STATE_LABEL, announcementsFor, assignmentState, assignmentsForStudent, attendanceFor, pastSessionsFor, upcomingSessionsFor } from "@/lib/student";
import { formatDateOnly, formatDateTime, relativeTime } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "My class" };

export default async function StudentCohortPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const [{ id: raw }, { welcome }, user, settings] = await Promise.all([params, searchParams, requireUser(), getSettings()]);
  const id = idParam(raw);
  if (!id || !(await isEnrolled(user.id, id))) notFound();
  const found = await getCohortWithCourse(id);
  if (!found) notFound();
  const { cohort, course } = found;
  const tz = settings.timezone;

  const [upcoming, past, work, news, instructors] = await Promise.all([
    upcomingSessionsFor([id]),
    pastSessionsFor([id]),
    assignmentsForStudent(user.id, [id]),
    announcementsFor([id]),
    getInstructorsByCohort([id]),
  ]);
  const marks = await attendanceFor(user.id, past.map((p) => p.session.id));
  const attended = [...marks.values()].filter((s) => s === "present" || s === "late").length;
  const markedCount = marks.size;
  const firstSession = upcoming[0]?.session;

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard", label: "Dashboard" }}
        title={course.title}
        description={<span className="flex flex-wrap items-center gap-2">{cohort.name}{cohort.startDate && <> · {formatDateOnly(cohort.startDate)}{cohort.endDate && ` – ${formatDateOnly(cohort.endDate)}`}</>} <ModeBadge mode={cohort.deliveryMode} /></span>}
        actions={firstSession && <a href={`/api/sessions/${firstSession.id}/ics?all=1`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-edge-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-page"><CalendarIcon className="size-4" /> Add timetable to calendar</a>}
      />
      {welcome && <Notice>You&apos;re enrolled. We&apos;ve emailed your confirmation, and you&apos;ll get reminders before every class.</Notice>}

      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Upcoming classes">
            {upcoming.length ? (
              <ul className="-my-4 divide-y divide-line">{upcoming.map(({ session }) => <SessionRow key={session.id} session={session} timeZone={tz} />)}</ul>
            ) : <p className="text-[15px] text-muted">No upcoming classes scheduled.</p>}
          </Card>

          <Card title="Assignments">
            {work.length ? (
              <ul className="-my-2 flex flex-col divide-y divide-line">
                {work.map(({ assignment, submission }) => {
                  const state = assignmentState(assignment, submission);
                  return (
                    <li key={assignment.id}>
                      <Link href={`/dashboard/assignments/${assignment.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3.5 hover:text-accent">
                        <span className="flex items-start gap-3">
                          <ClipboardIcon className="mt-0.5 size-5 text-accent" />
                          <span className="flex flex-col gap-0.5">
                            <span className="font-semibold text-ink">{assignment.title}</span>
                            <span className="text-sm text-muted">{assignment.dueAt ? `Due ${formatDateTime(assignment.dueAt, tz)}` : "No deadline"}</span>
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          {submission?.status === "graded" && submission.score !== null && <span className="font-display font-bold text-emerald-700">{submission.score}/{assignment.maxScore}</span>}
                          <Badge tone={STATE_LABEL[state].tone}>{STATE_LABEL[state].label}</Badge>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-[15px] text-muted">No assignments yet.</p>}
          </Card>

          {past.length > 0 && (
            <Card title="Past classes" action={markedCount > 0 ? <span className="text-sm text-muted">Attended {attended} of {markedCount}</span> : undefined}>
              <ul className="-my-4 divide-y divide-line">{past.map(({ session }) => <SessionRow key={session.id} session={session} timeZone={tz} attendance={marks.get(session.id)} />)}</ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Announcements">
            {news.length ? (
              <ul className="-my-2 flex flex-col divide-y divide-line">
                {news.map(({ announcement, author }) => (
                  <li key={announcement.id} className="flex flex-col gap-2 py-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={author?.name ?? "Academy"} src={author?.avatarUrl} size="sm" />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-ink">{author?.name ?? "Academy"}</span>
                        <span className="text-xs text-muted">{relativeTime(announcement.createdAt)}</span>
                      </div>
                    </div>
                    <p className="font-semibold text-ink">{announcement.title}</p>
                    {announcement.body && <div className="text-[15px]"><Markdown>{announcement.body}</Markdown></div>}
                  </li>
                ))}
              </ul>
            ) : <p className="flex items-center gap-2 text-[15px] text-muted"><MegaphoneIcon className="size-5" /> Nothing posted yet.</p>}
          </Card>
          {(instructors.get(id) ?? []).length > 0 && (
            <Card title="Instructors">
              <ul className="flex flex-col gap-4">
                {instructors.get(id)!.map((i) => (
                  <li key={i.id} className="flex items-center gap-3">
                    <Avatar name={i.name} src={i.avatarUrl} />
                    <div className="flex min-w-0 flex-col">
                      <span className="font-semibold text-ink">{i.name}</span>
                      <a href={`mailto:${i.email}`} className="truncate text-sm text-accent">{i.email}</a>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {cohort.venue && cohort.deliveryMode !== "virtual" && (
            <Card title="Venue">
              <p className="flex gap-2 text-[15px] text-body"><PinIcon className="mt-0.5 size-5 shrink-0 text-cyan" /> {cohort.venue}</p>
              {cohort.schedule && <p className="mt-2 text-sm text-muted">{cohort.schedule}</p>}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
