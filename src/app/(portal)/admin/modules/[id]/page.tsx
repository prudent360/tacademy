import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteModule, updateModule } from "@/app/actions/learning";
import { ModuleForm } from "@/components/admin/learning-forms";
import { DeleteButton } from "@/components/forms";
import { PlusIcon } from "@/components/icons";
import { Badge, Card, Notice, PageHeader, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { courseModules, courses, lessons } from "@/db/schema";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit module" };

export default async function EditModulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id: raw }, { created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const [module] = await db.select({ module: courseModules, course: courses }).from(courseModules).innerJoin(courses, eq(courses.id, courseModules.courseId)).where(eq(courseModules.id, id));
  if (!module) notFound();
  const items = await db.select().from(lessons).where(eq(lessons.moduleId, id)).orderBy(asc(lessons.position), asc(lessons.id));
  return <>
    <PageHeader back={{ href: `/admin/courses/${module.course.id}`, label: module.course.title }} title={module.module.title} actions={<Link href={`/admin/lessons/new?module=${id}`} className={buttonClass.primary}><PlusIcon className="size-4" /> Add lesson</Link>} />
    {created && <Notice>Module created. Add lessons, then publish the module when it is ready.</Notice>}
    <Card title="Lessons" padded={false}>{items.length ? <ul className="divide-y divide-line">{items.map((lesson) => <li key={lesson.id}><Link href={`/admin/lessons/${lesson.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-panel md:px-6"><span><span className="font-semibold text-ink">{lesson.title}</span><span className="ml-2 text-sm text-muted">{lesson.estimatedMinutes} min</span></span>{lesson.published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}</Link></li>)}</ul> : <p className="p-6 text-muted">No lessons yet. <Link className="font-semibold text-accent" href={`/admin/lessons/new?module=${id}`}>Add the first lesson</Link>.</p>}</Card>
    <Card title="Module settings"><ModuleForm action={updateModule.bind(null, id)} module={module.module} /></Card>
    <div className="flex justify-end"><DeleteButton action={deleteModule.bind(null, id)} label="Delete module and lessons" /></div>
  </>;
}
