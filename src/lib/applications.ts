import type { ApplicationStatus, StudyMode } from "@/db/schema";

/** Answer options for the internship application form, shared by the form, validation and the admin screens. */
export const CURRENT_STATUSES = ["Student", "Graduate looking for work", "Employed, looking to switch careers", "Self-employed", "Other"] as const;
export const EXPERIENCE_LEVELS = ["Beginner", "Some experience", "Confident"] as const;
export const HOURS_PER_WEEK = ["Under 10 hours", "10–20 hours", "20+ hours"] as const;
export const HEARD_FROM = ["Instagram", "LinkedIn", "Facebook", "X (Twitter)", "WhatsApp", "Friend or colleague", "Google search", "Tekskillup course", "Other"] as const;
export const STUDY_MODES: { value: StudyMode; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "in_person", label: "In person" },
  { value: "either", label: "Either" },
];
export const MODE_LABELS: Record<StudyMode, string> = { remote: "Remote", in_person: "In person", either: "Either" };
export const STATUS_LABELS: Record<ApplicationStatus, string> = { new: "New", shortlisted: "Shortlisted", accepted: "Accepted", rejected: "Not successful" };
export const STATUS_TONE: Record<ApplicationStatus, "accent" | "cyan" | "green" | "neutral"> = { new: "accent", shortlisted: "cyan", accepted: "green", rejected: "neutral" };
export const MOTIVATION_MAX = 500;

/** Answer options for the "Become an instructor" form. */
export const YEARS_EXPERIENCE = ["1–2 years", "3–5 years", "6–10 years", "10+ years"] as const;
export const TEACHING_EXPERIENCE = ["I haven't taught before", "I've mentored or coached people", "I've run classes or workshops", "I teach or train professionally"] as const;
export const AVAILABILITY = ["Weekday evenings", "Weekends", "Weekday daytime", "Flexible"] as const;
export const TOPICS_MAX = 800;
