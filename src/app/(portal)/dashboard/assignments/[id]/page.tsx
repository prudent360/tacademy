import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { submitAssignment } from "@/app/actions/student";
import { ActionForm, FileField, Input, SubmitButton, Textarea } from "@/components/forms";
import { FileIcon, LinkIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { assignments, submissions, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCohortWithCourse, getSettings, isEnrolled } from "@/lib/data";
import { STATE_LABEL, assignmentState } from "@/lib/student";
import { formatDateTime, relativeTime } from "@/lib/time";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Assignment" };

export default async function StudentAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id: raw }, user, settings] = await Promise.all([params, requireUser(), getSettings()]);
  const id = idParam(raw);
  if (!id) notFound();
  const db = await getDb();
  const [assignment] = await db.select().from(assignments).where(and(eq(assignments.id, id), eq(assignments.published, true)));
  if (!assignment || !(await isEnrolled(user.id, assignment.cohortId))) notFound();
  const found = await getCohortWithCourse(assignment.cohortId);
  const [submission] = await db.select().from(submissions).where(and(eq(submissions.assignmentId, id), eq(submissions.userId, user.id)));
  const [grader] = submission?.gradedById ? await db.select({ name: users.name }).from(users).where(eq(users.id, submission.gradedById)) : [];
  const state = assignmentState(assignment, submission ?? null);
  const canSubmit = state !== "graded";
  const tz = settings.timezone;

  return (
    <>
      <PageHeader
        back={{ href: `/dashboard/cohorts/${assignment.cohortId}`, label: found?.course.title ?? "Back" }}
        title={assignment.title}
        description={<span className="flex flex-wrap items-center gap-2">{assignment.dueAt ? `Due ${formatDateTime(assignment.dueAt, tz)}` : "No deadline"} · {assignment.maxScore} points <Badge tone={STATE_LABEL[state].tone}>{STATE_LABEL[state].label}</Badge></span>}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Instructions">
            {assignment.instructions ? <Markdown>{assignment.instructions}</Markdown> : <p className="text-muted">No written instructions.</p>}
            {assignment.attachmentUrl && (
              <a href={assignment.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-edge-strong px-4 text-sm font-semibold text-ink hover:bg-page">
                <FileIcon className="size-4" /> Download brief / resources
              </a>
            )}
          </Card>

          {submission && (submission.status === "graded" || submission.status === "resubmit") && (
            <Card title={submission.status === "graded" ? "Feedback" : "Changes requested"} className={submission.status === "graded" ? "border-emerald-200" : "border-cyan/40"}>
              <div className="flex flex-col gap-4">
                {submission.score !== null && (
                  <p className="font-display text-4xl font-bold text-ink">{submission.score}<span className="text-xl text-muted">/{assignment.maxScore}</span></p>
                )}
                {submission.feedback ? <Markdown>{submission.feedback}</Markdown> : <p className="text-muted">No written comments.</p>}
                <p className="text-sm text-muted">{grader ? `From ${grader.name}` : ""}{submission.gradedAt ? ` · ${relativeTime(submission.gradedAt)}` : ""}</p>
              </div>
            </Card>
          )}
        </div>

        <Card title={submission ? "Your submission" : "Submit your work"}>
          {submission && (
            <div className="mb-5 flex flex-col gap-3 border-b border-line pb-5">
              <p className="text-sm text-muted">Submitted {formatDateTime(submission.submittedAt, tz)}</p>
              {submission.body && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-body">{submission.body}</p>}
              {submission.fileUrl && <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-semibold text-accent"><FileIcon className="size-4" /> {submission.fileName ?? "Attached file"}</a>}
              {submission.linkUrl && <a href={submission.linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 break-all text-sm font-semibold text-accent"><LinkIcon className="size-4 shrink-0" /> {submission.linkUrl}</a>}
            </div>
          )}
          {canSubmit ? (
            <ActionForm action={submitAssignment.bind(null, assignment.id)}>
              {state === "overdue" && <Notice tone="amber">The deadline has passed, but you can still submit. Your instructor will see it was late.</Notice>}
              <Textarea label="Written answer" name="body" rows={6} defaultValue={submission?.body ?? ""} hint="Optional if you attach a file or link." />
              <FileField label="Attach a file" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.csv,.txt,.ipynb,.sql,.py,.pbix,image/*" removeName="removeFile" current={submission?.fileUrl} hint="PDF, Office, image, ZIP, CSV, notebook or text file, up to 4 MB." />
              <Input label="Or share a link" name="linkUrl" type="url" placeholder="https://github.com/… or a Google Drive / Power BI link" defaultValue={submission?.linkUrl ?? ""} />
              <SubmitButton pendingText="Submitting…">{submission ? "Resubmit" : "Submit"}</SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-sm text-muted">This work has been graded, so it can no longer be changed.</p>
          )}
        </Card>
      </div>
    </>
  );
}
