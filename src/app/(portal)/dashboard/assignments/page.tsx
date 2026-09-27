import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardIcon } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { STATE_LABEL, assignmentState, assignmentsForStudent, studentCohortIds } from "@/lib/student";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Assignments" };

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const [user, settings, { filter = "open" }] = await Promise.all([requireUser(), getSettings(), searchParams]);
  const all = await assignmentsForStudent(user.id, await studentCohortIds(user.id));
  const withState = all.map((a) => ({ ...a, state: assignmentState(a.assignment, a.submission) }));
  const open = withState.filter((a) => ["todo", "overdue", "resubmit"].includes(a.state));
  const shown = filter === "all" ? withState : filter === "done" ? withState.filter((a) => ["submitted", "graded"].includes(a.state)) : open;

  return (
    <>
      <PageHeader title="Assignments" description="Submit your work and read your instructors' feedback." />
      <Tabs current={filter} items={[
        { key: "open", label: "To do", href: "/dashboard/assignments", count: open.length },
        { key: "done", label: "Submitted", href: "/dashboard/assignments?filter=done" },
        { key: "all", label: "All", href: "/dashboard/assignments?filter=all", count: withState.length },
      ]} />
      {shown.length ? (
        <DataTable>
          <thead><tr><th>Assignment</th><th>Course</th><th>Due</th><th>Status</th><th>Score</th></tr></thead>
          <tbody>
            {shown.map(({ assignment, course, submission, state }) => (
              <tr key={assignment.id}>
                <td><Link href={`/dashboard/assignments/${assignment.id}`} className="font-semibold text-ink hover:text-accent">{assignment.title}</Link></td>
                <td className="text-muted">{course.title}</td>
                <td className="whitespace-nowrap text-muted">{assignment.dueAt ? formatDateTime(assignment.dueAt, settings.timezone, { zone: false }) : "–"}</td>
                <td><Badge tone={STATE_LABEL[state].tone}>{STATE_LABEL[state].label}</Badge></td>
                <td className="font-semibold">{submission?.status === "graded" && submission.score !== null ? `${submission.score}/${assignment.maxScore}` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState icon={ClipboardIcon} title={filter === "open" ? "Nothing to do right now" : "No assignments here yet"}>New assignments from your instructors will appear here, and we&apos;ll email you when they do.</EmptyState>
      )}
    </>
  );
}
