import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { StudentImport } from "@/components/admin/student-import";
import { PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courses } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { formatDateOnly } from "@/lib/time";

export const metadata: Metadata = { title: "Import students" };

export default async function ImportStudentsPage({ searchParams }: { searchParams: Promise<{ cohort?: string }> }) {
  await requirePermission("users.manage");
  const today = new Date().toISOString().slice(0, 10);
  const rows = await (await getDb())
    .select({ id: cohorts.id, name: cohorts.name, startDate: cohorts.startDate, endDate: cohorts.endDate, course: courses.title })
    .from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId))
    .orderBy(asc(courses.title), desc(cohorts.startDate));
  // Finished cohorts go last; people are usually imported into current or upcoming ones.
  const options = [...rows.filter((c) => !c.endDate || c.endDate >= today), ...rows.filter((c) => c.endDate && c.endDate < today)].map((c) => ({
    id: c.id,
    label: `${c.course} – ${c.name}${c.startDate ? ` (${c.endDate && c.endDate < today ? "ended" : "starts"} ${formatDateOnly(c.endDate && c.endDate < today ? c.endDate : c.startDate)})` : ""}`,
  }));
  const requested = Number((await searchParams).cohort);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/users", label: "People" }}
        title="Import students"
        description="Add many students at once from a spreadsheet, and enrol them on a cohort if you like. People who already have an account are matched by email, never duplicated."
      />
      <StudentImport cohorts={options} defaultCohort={options.some((o) => o.id === requested) ? requested : null} />
    </>
  );
}
