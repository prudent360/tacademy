import { redirect } from "next/navigation";

/** Cohorts are run from one page for admins and instructors; old admin links land on its settings. */
export default async function AdminCohortPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/teach/cohorts/${encodeURIComponent((await params).id)}?tab=settings`);
}
