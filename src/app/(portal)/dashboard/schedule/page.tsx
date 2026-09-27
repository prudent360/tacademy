import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon } from "@/components/icons";
import { SessionRow } from "@/components/portal/session-row";
import { EmptyState, PageHeader, Tabs, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { attendanceFor, pastSessionsFor, studentCohortIds, upcomingSessionsFor } from "@/lib/student";

export const metadata: Metadata = { title: "Timetable" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const [user, settings, { view }] = await Promise.all([requireUser(), getSettings(), searchParams]);
  const ids = await studentCohortIds(user.id);
  const showPast = view === "past";
  const rows = showPast ? await pastSessionsFor(ids, 100) : await upcomingSessionsFor(ids, 100);
  const marks = showPast ? await attendanceFor(user.id, rows.map((r) => r.session.id)) : new Map();

  return (
    <>
      <PageHeader title="Timetable" description={`All your classes across every course. Times are shown in ${settings.timezone.replace("_", " ")} time.`} />
      <Tabs current={showPast ? "past" : "upcoming"} items={[{ key: "upcoming", label: "Upcoming", href: "/dashboard/schedule" }, { key: "past", label: "Past", href: "/dashboard/schedule?view=past" }]} />
      {rows.length ? (
        <div className="rounded-[14px] border border-edge bg-white px-5 md:px-6">
          <ul className="divide-y divide-line">
            {rows.map(({ session, course }) => <SessionRow key={session.id} session={session} courseTitle={course.title} timeZone={settings.timezone} attendance={marks.get(session.id)} />)}
          </ul>
        </div>
      ) : (
        <EmptyState icon={CalendarIcon} title={showPast ? "No past classes yet" : "No upcoming classes"} action={ids.length ? undefined : <Link href="/courses" className={buttonClass.primary}>Browse courses</Link>}>
          {ids.length ? "When your instructors schedule classes, they'll show up here." : "Enrol on a cohort to see your timetable."}
        </EmptyState>
      )}
    </>
  );
}
