import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteCourse, updateCourse } from "@/app/actions/admin";
import { CourseForm } from "@/components/admin/course-form";
import { DeleteButton } from "@/components/forms";
import { ExternalIcon, PlusIcon } from "@/components/icons";
import { Badge, Card, ModeBadge, Notice, PageHeader, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courseModules, courses, lessons } from "@/db/schema";
import { seatsTaken } from "@/lib/data";
import { formatDateOnly } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit course" };

export default async function EditCoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id: raw }, { created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, id));
  if (!course) notFound();
  const [list, modules] = await Promise.all([
    db.select().from(cohorts).where(eq(cohorts.courseId, id)).orderBy(asc(cohorts.startDate)),
    db.select({ module: courseModules, lessonId: lessons.id }).from(courseModules).leftJoin(lessons, eq(lessons.moduleId, courseModules.id)).where(eq(courseModules.courseId, id)).orderBy(asc(courseModules.position), asc(courseModules.id)),
  ]);
  const taken = await seatsTaken(list.map((c) => c.id));
  const moduleList = [...new Map(modules.map((row) => [row.module.id, { ...row.module, lessons: modules.filter((x) => x.module.id === row.module.id && x.lessonId).length }])).values()];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/courses", label: "Courses" }}
        title={course.title}
        actions={<>
          {course.published && <Link href={`/courses/${course.slug}`} target="_blank" className={buttonClass.secondary}><ExternalIcon className="size-4" /> View page</Link>}
          <Link href={`/admin/cohorts/new?course=${id}`} className={buttonClass.primary}><PlusIcon className="size-4" /> Add cohort</Link>
        </>}
      />
      {created && <Notice>Course created. Next, add a cohort with dates and prices{course.published ? "" : ", then publish the course"}.</Notice>}
      <Card title="Learning modules" padded={false} action={<Link href={`/admin/modules/new?course=${id}`} className={buttonClass.secondary}><PlusIcon className="size-4" /> Add module</Link>}>
        {moduleList.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {moduleList.map((module) => (
              <li key={module.id}>
                <Link href={`/admin/modules/${module.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-panel md:px-6">
                  <span className="flex min-w-0 flex-col gap-0.5"><span className="font-semibold text-ink">{module.title}</span><span className="truncate text-sm text-muted">{module.summary || "No summary yet"}</span></span>
                  <span className="flex shrink-0 items-center gap-2"><Badge>{module.lessons} lesson{module.lessons === 1 ? "" : "s"}</Badge>{module.published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="p-6 text-muted">No learning modules yet. <Link href={`/admin/modules/new?course=${id}`} className="font-semibold text-accent">Create the first module</Link>.</p>}
      </Card>
      <Card title="Cohorts" padded={false}>
        {list.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/cohorts/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-panel md:px-6">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">{c.name}</span>
                    <span className="text-sm text-muted">{c.startDate ? `${formatDateOnly(c.startDate)}${c.endDate ? ` – ${formatDateOnly(c.endDate)}` : ""}` : "Dates TBC"}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <ModeBadge mode={c.deliveryMode} />
                    <Badge>{taken.get(c.id) ?? 0}{c.capacity ? `/${c.capacity}` : ""} enrolled</Badge>
                    {!c.enrollmentOpen && <Badge tone="amber">Closed</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="p-6 text-muted">No cohorts yet. <Link href={`/admin/cohorts/new?course=${id}`} className="font-semibold text-accent">Add the first one</Link>.</p>}
      </Card>
      <Card title="Course details"><CourseForm action={updateCourse.bind(null, id)} course={course} /></Card>
      <div className="flex justify-end"><DeleteButton action={deleteCourse.bind(null, id)} label="Delete course and its cohorts" /></div>
    </>
  );
}
