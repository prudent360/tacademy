import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { gradeSubmission } from "@/app/actions/teach";
import { GradeForm } from "@/components/teach/grade-form";
import { FileIcon, LinkIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { assignments, submissions, users } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { formatDateTime } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Review submission" };

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = idParam((await params).id);
  if (!id) notFound();
  const db = await getDb();
  const [row] = await db
    .select({ submission: submissions, assignment: assignments, student: { name: users.name, email: users.email } })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .innerJoin(users, eq(users.id, submissions.userId))
    .where(eq(submissions.id, id));
  if (!row) notFound();
  await requireTeacher(row.assignment.cohortId);
  const settings = await getSettings();
  const { submission, assignment, student } = row;
  const late = assignment.dueAt && new Date(submission.submittedAt) > new Date(assignment.dueAt);

  return (
    <>
      <PageHeader back={{ href: `/teach/assignments/${assignment.id}`, label: assignment.title }} title={student.name} description={<span className="flex flex-wrap items-center gap-2">Submitted {formatDateTime(submission.submittedAt, settings.timezone)} {late && <Badge tone="amber">Late</Badge>} <StatusBadge status={submission.status} label={submission.status === "submitted" ? "To grade" : submission.status === "resubmit" ? "Changes requested" : "Graded"} /></span>} />
      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Submission">
            <div className="flex flex-col gap-4">
              {submission.body ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-body">{submission.body}</p> : <p className="text-muted">No written answer.</p>}
              {submission.fileUrl && <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-edge-strong px-4 text-sm font-semibold text-ink hover:bg-page"><FileIcon className="size-4" /> {submission.fileName ?? "Download file"}</a>}
              {submission.linkUrl && <a href={submission.linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 break-all text-sm font-semibold text-accent"><LinkIcon className="size-4 shrink-0" /> {submission.linkUrl}</a>}
            </div>
          </Card>
          <Card title="Assignment brief">
            {assignment.instructions ? <Markdown>{assignment.instructions}</Markdown> : <p className="text-muted">No written instructions.</p>}
          </Card>
        </div>
        <Card title="Feedback">
          <GradeForm action={gradeSubmission.bind(null, id)} maxScore={assignment.maxScore} score={submission.score} feedback={submission.feedback} />
        </Card>
      </div>
    </>
  );
}
