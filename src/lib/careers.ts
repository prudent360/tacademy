import type { JobApplicationStatus, JobMode, JobOpening, JobStatus, JobType } from "@/db/schema";

export const JOB_TYPE_LABEL: Record<JobType, string> = { full_time: "Full-time", part_time: "Part-time", contract: "Contract", internship: "Internship", volunteer: "Volunteer" };
export const JOB_MODE_LABEL: Record<JobMode, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
export const JOB_STATUS_LABEL: Record<JobStatus, string> = { draft: "Draft", open: "Open", closed: "Closed" };
export const JOB_STATUS_TONE: Record<JobStatus, "neutral" | "green" | "amber"> = { draft: "neutral", open: "green", closed: "amber" };

export const JOB_APPLICATION_LABEL: Record<JobApplicationStatus, string> = { new: "New", reviewing: "Reviewing", interview: "Interview", offer: "Offer made", hired: "Hired", rejected: "Not progressing" };
export const JOB_APPLICATION_TONE: Record<JobApplicationStatus, "accent" | "cyan" | "amber" | "green" | "navy" | "red"> = { new: "accent", reviewing: "cyan", interview: "amber", offer: "navy", hired: "green", rejected: "red" };

export const NOTICE_PERIODS = ["Available now", "1 week", "2 weeks", "1 month", "2 months", "3 months or more"] as const;

/** Today's date (YYYY-MM-DD) in UTC, for comparing with closing dates. */
export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Open, and the closing date (if any) hasn't passed. */
export function isAccepting(job: Pick<JobOpening, "status" | "closesOn">, today = todayIso()): boolean {
  return job.status === "open" && (!job.closesOn || job.closesOn >= today);
}

/** One item per line, blank lines and stray bullets removed. */
export function parseLines(value: FormDataEntryValue | null, max = 30): string[] {
  return String(value ?? "").split("\n").map((l) => l.trim().replace(/^[-•*]\s*/, "")).filter(Boolean).slice(0, max).map((l) => l.slice(0, 300));
}
