import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";

/** Cohorts are run from one page for admins and instructors; old admin links land on its settings. */
export default async function AdminCohortPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("courses.manage");
  redirect(`/teach/cohorts/${encodeURIComponent((await params).id)}?tab=settings`);
}
