import type { Metadata } from "next";
import Link from "next/link";
import { CalendarIcon } from "@/components/icons";
import { SessionRow } from "@/components/portal/session-row";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getSettings, getTeachingCohortIds } from "@/lib/data";
import { upcomingSessionsFor } from "@/lib/student";

export const metadata: Metadata = { title: "Teaching timetable" };

export default async function TeachSchedulePage() {
  const [user, settings] = await Promise.all([requireRole("admin", "instructor"), getSettings()]);
  const rows = await upcomingSessionsFor(await getTeachingCohortIds(user), 100);
  return (
    <>
      <PageHeader title="Teaching timetable" description={`Upcoming classes across your cohorts (${settings.timezone.replace("_", " ")} time).`} />
      {rows.length ? (
        <div className="rounded-[14px] border border-edge bg-white px-5 md:px-6">
          <ul className="divide-y divide-line">
            {rows.map(({ session, course }) => (
              <SessionRow key={session.id} session={session} courseTitle={course.title} timeZone={settings.timezone}>
                <Link href={`/teach/sessions/${session.id}`} className="w-fit text-sm font-semibold text-accent hover:text-accent-dark">Edit class & take attendance →</Link>
              </SessionRow>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState icon={CalendarIcon} title="No upcoming classes">Add classes from a cohort&apos;s page.</EmptyState>
      )}
    </>
  );
}
