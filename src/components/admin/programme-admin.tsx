import Link from "next/link";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { deleteCourse, updateCourse } from "@/app/actions/admin";
import { CourseForm } from "@/components/admin/course-form";
import { CurriculumBuilder } from "@/components/admin/curriculum-builder";
import { DeleteButton } from "@/components/forms";
import { ExternalIcon, PlusIcon } from "@/components/icons";
import { Badge, Card, ModeBadge, Notice, PageHeader, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courses, internshipApplications, type Course } from "@/db/schema";
import { aiAvailable } from "@/lib/ai";
import { curriculumFor } from "@/lib/curriculum";
import { linkedCourseIds, seatsTaken } from "@/lib/data";
import { formatDateOnly } from "@/lib/time";

const WORDS = {
  course: { list: "/admin/courses", listLabel: "Courses", run: "cohort", runs: "Cohorts", details: "Course details", created: "Course created. Next, add a cohort with dates and prices", remove: "Delete course and its cohorts" },
  internship: { list: "/admin/internships", listLabel: "Internships", run: "intake", runs: "Intakes", details: "Internship details", created: "Internship created. Next, link the courses whose graduates join free, and add an intake with dates and fees", remove: "Delete internship and its intakes" },
} as const;

/** The admin screen for one course or internship programme: its runs (cohorts or intakes), learning modules and details. */
export async function ProgrammeAdmin({ course, created }: { course: Course; created?: boolean }) {
  const kind = course.kind;
  const w = WORDS[kind];
  const db = await getDb();
  const [list, curriculum, ai, linked, courseOptions, applicationCount] = await Promise.all([
    db.select().from(cohorts).where(eq(cohorts.courseId, course.id)).orderBy(asc(cohorts.startDate)),
    curriculumFor(course.id),
    aiAvailable("writing"),
    kind === "internship" ? linkedCourseIds(course.id) : Promise.resolve([] as number[]),
    kind === "internship" ? db.select({ id: courses.id, title: courses.title }).from(courses).where(eq(courses.kind, "course")).orderBy(asc(courses.sortOrder), asc(courses.title)) : Promise.resolve([]),
    kind === "internship" ? db.select({ n: count() }).from(internshipApplications).where(and(eq(internshipApplications.skillArea, course.title), inArray(internshipApplications.status, ["new", "shortlisted"]))).then((r) => r[0]?.n ?? 0) : Promise.resolve(0),
  ]);
  const taken = await seatsTaken(list.map((c) => c.id));
  const linkedTitles = courseOptions.filter((c) => linked.includes(c.id)).map((c) => c.title);

  return (
    <>
      <PageHeader
        back={{ href: w.list, label: w.listLabel }}
        title={course.title}
        actions={<>
          {course.published && <Link href={`/courses/${course.slug}`} target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View page</Link>}
          <Link href={`/admin/cohorts/new?course=${course.id}`} className={buttonClass.primary}><PlusIcon className="size-4" /> Add {w.run}</Link>
        </>}
      />
      {created && <Notice>{w.created}{course.published ? "." : ", then publish it."}</Notice>}
      {kind === "internship" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Who joins free">
            <p className="text-sm text-body">{linkedTitles.length ? <>Graduates of <strong className="text-ink">{linkedTitles.join(", ")}</strong> join intakes marked “free for graduates” without paying.</> : "No courses linked yet, so graduates of any course join intakes marked “free for graduates” free."} Change this under Internship details below.</p>
          </Card>
          <Card title="Applications">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-body">{applicationCount ? `${applicationCount} waiting for review.` : "None waiting for review."}</p>
              <Link href={`/admin/applications?q=${encodeURIComponent(course.title)}`} className={buttonClass.secondary}>View applications</Link>
            </div>
          </Card>
        </div>
      )}
      <Card title={w.runs} padded={false}>
        {list.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/teach/cohorts/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-panel md:px-6">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">{c.name}</span>
                    <span className="text-sm text-muted">{c.startDate ? `${formatDateOnly(c.startDate)}${c.endDate ? ` – ${formatDateOnly(c.endDate)}` : ""}` : "Dates TBC"}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <ModeBadge mode={c.deliveryMode} />
                    <Badge>{taken.get(c.id) ?? 0}{c.capacity ? `/${c.capacity}` : ""} {kind === "internship" ? "interns" : "enrolled"}</Badge>
                    {c.graduatesFree && <Badge tone="green">Free for graduates</Badge>}
                    {!c.enrollmentOpen && <Badge tone="amber">Closed</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="p-6 text-muted">No {w.run}s yet. <Link href={`/admin/cohorts/new?course=${course.id}`} className="font-semibold text-accent-ink">Add the first one</Link>.</p>}
      </Card>
      <div id="curriculum" className="scroll-mt-24">
        <Card title="Curriculum" action={<span className="hidden text-sm text-muted sm:block">Shared by every {w.run} of this {kind === "internship" ? "programme" : "course"}</span>}>
          <CurriculumBuilder courseId={course.id} modules={curriculum} lessonHref="/admin/lessons/{id}" canDelete />
        </Card>
      </div>
      <Card title={w.details}><CourseForm action={updateCourse.bind(null, course.id)} course={course} ai={ai} kind={kind} linkable={courseOptions} linked={linked} /></Card>
      <div className="flex justify-end"><DeleteButton action={deleteCourse.bind(null, course.id)} label={w.remove} /></div>
    </>
  );
}
