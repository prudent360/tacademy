import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { courseModules } from "@/db/schema";
import { idParam } from "@/lib/validation";

/** Modules are edited in the curriculum builder on the course page; old links land there. */
export default async function ModuleRedirect({ params }: { params: Promise<{ id: string }> }) {
  const id = idParam((await params).id);
  if (!id) notFound();
  const [module] = await (await getDb()).select({ courseId: courseModules.courseId }).from(courseModules).where(eq(courseModules.id, id));
  if (!module) notFound();
  redirect(`/admin/courses/${module.courseId}#curriculum`);
}
