import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardIcon } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getSettings, getTeachingCohortIds } from "@/lib/data";
import { gradingQueue } from "@/lib/teach";
import { relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "To grade" };

export default async function GradingPage() {
  const [user] = await Promise.all([requireRole("admin", "instructor"), getSettings()]);
  const queue = await gradingQueue(await getTeachingCohortIds(user));
  return (
    <>
      <PageHeader title="To grade" description="Submissions waiting for your feedback, oldest first." />
      {queue.length ? (
        <DataTable>
          <thead><tr><th>Student</th><th>Assignment</th><th>Course</th><th>Submitted</th><th /></tr></thead>
          <tbody>
            {queue.map(({ submission, assignment, student, course, cohort }) => {
              const late = assignment.dueAt && new Date(submission.submittedAt) > new Date(assignment.dueAt);
              return (
                <tr key={submission.id}>
                  <td className="font-semibold text-ink">{student.name}</td>
                  <td>{assignment.title}</td>
                  <td className="text-muted">{course.title} · {cohort.name}</td>
                  <td className="whitespace-nowrap text-muted">{relativeTime(submission.submittedAt)} {late && <Badge tone="amber">Late</Badge>}</td>
                  <td className="text-right"><Link href={`/teach/submissions/${submission.id}`} className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent-dark">Review</Link></td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState icon={ClipboardIcon} title="All caught up">New submissions will appear here, and you&apos;ll get an email when a student submits.</EmptyState>
      )}
    </>
  );
}
