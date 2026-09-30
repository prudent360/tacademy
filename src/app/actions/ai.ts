"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { assignments, cohorts, courseModules, courses, enrollments, lessons, moduleReleases, submissions } from "@/db/schema";
import { aiQuota, askAi, trimChat, type AiResult } from "@/lib/ai";
import { getCurrentUser, requireCourseEditor, requireRole, requireTeacher } from "@/lib/auth";
import { fromPrice, isFree, withCohorts } from "@/lib/catalog";
import { getPublishedCourses, getSettings } from "@/lib/data";
import { COMMON_VARIABLES, EMAIL_TEMPLATES, isTemplateKey } from "@/lib/email-templates";
import { formatMoney } from "@/lib/money";
import { clientAddress } from "@/lib/rate-limit";
import { formatDateOnly } from "@/lib/time";
import { MODE_LABEL } from "@/lib/utils";
import { visitorCurrencies } from "@/lib/visitor";

export type ChatTurn = { role: "user" | "assistant"; content: string };
/** Values to put into the form's fields, by field name. */
export type AiDraft = { fields: Record<string, string> } | { error: string };

const chatSchema = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(40);

// ---------- Course advisor (public) ----------

/** Answers a visitor's questions and recommends programmes, using only what's published on the site. */
export async function askAdvisor(history: ChatTurn[]): Promise<AiResult> {
  const parsed = chatSchema.safeParse(history);
  if (!parsed.success) return { error: "Please type a shorter message." };
  const limited = await aiQuota("advisor", await clientAddress(), 30);
  if (limited) return { error: limited };

  const settings = await getSettings();
  const [courseList, { currencies }] = await Promise.all([getPublishedCourses().then(withCohorts), visitorCurrencies(settings)]);
  const catalogue = courseList.map((c) => {
    const open = c.cohorts.filter((co) => co.enrollmentOpen && !co.full);
    const price = fromPrice(open, currencies);
    const intakes = open.slice(0, 3).map((co) => `${co.name} (${MODE_LABEL[co.deliveryMode]}${co.startDate ? `, starts ${formatDateOnly(co.startDate)}` : ""}${co.graduatesFree ? ", free for academy graduates" : ""}${isFree(co) ? ", free" : ""})`);
    return [
      `## ${c.title} [${c.kind === "internship" ? "Internship" : "Course"}]`,
      `Link: /courses/${c.slug}`,
      `Level: ${c.level}${c.durationWeeks ? ` · ${c.durationWeeks} weeks` : ""}${c.category ? ` · ${c.category}` : ""}`,
      `Price: ${price === "free" ? "Free" : price ? `from ${formatMoney(price.amount, price.currency)}` : "on request"}`,
      `Open intakes: ${intakes.length ? intakes.join("; ") : "none open right now"}`,
      `Summary: ${c.summary}`,
      c.outcomes.length ? `Outcomes: ${c.outcomes.slice(0, 6).join("; ")}` : "",
      c.jobRoles.length ? `Roles it prepares for: ${c.jobRoles.slice(0, 6).join(", ")}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  return askAi("advisor", {
    system: `You are the course advisor on the website of ${settings.siteName}, a tech training academy. Help visitors choose a course or internship that fits their goals, experience and schedule.

- Recommend only programmes from the catalogue below, and link to them with Markdown links using their exact Link path, e.g. [Data Analytics](/courses/data-analytics).
- Quote prices, dates and formats exactly as listed. If something isn't in the catalogue, say you don't know and suggest ${settings.supportEmail ? `emailing ${settings.supportEmail}` : "contacting the academy"}.
- If you don't know enough about the visitor yet, ask one or two short questions (their goal, current experience, and whether they prefer online or in person).
- Keep replies short and friendly: a few sentences or a short list. To enrol, visitors use the "Enrol now" button on the course page.
- Politely steer unrelated conversations back to choosing a course.`,
    context: `Catalogue:\n\n${catalogue || "No programmes are published right now."}`,
    messages: trimChat(parsed.data),
    maxTokens: 2000,
  });
}

// ---------- Lesson study buddy (enrolled students) ----------

export async function askLessonBuddy(cohortId: number, lessonId: number, history: ChatTurn[]): Promise<AiResult> {
  const parsed = chatSchema.safeParse(history);
  if (!parsed.success) return { error: "Please type a shorter message." };
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const db = await getDb();
  const [found] = await db.select({ lesson: lessons, module: courseModules, course: courses, releaseAt: moduleReleases.releaseAt }).from(enrollments)
    .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
    .innerJoin(courses, eq(courses.id, cohorts.courseId))
    .innerJoin(courseModules, eq(courseModules.courseId, courses.id))
    .innerJoin(lessons, eq(lessons.moduleId, courseModules.id))
    .leftJoin(moduleReleases, and(eq(moduleReleases.cohortId, cohorts.id), eq(moduleReleases.moduleId, courseModules.id)))
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.cohortId, cohortId), inArray(enrollments.status, ["active", "completed"]), eq(lessons.id, lessonId), eq(courseModules.published, true), eq(lessons.published, true)));
  if (!found || (found.releaseAt && found.releaseAt > new Date())) return { error: "This lesson isn't available." };
  const limited = await aiQuota("study", String(user.id), 40);
  if (limited) return { error: limited };

  return askAi("studyBuddy", {
    system: `You are a patient study buddy for a student on the "${found.course.title}" course. Help them understand the lesson below: explain ideas in plain language, give short worked examples, and when asked, quiz them with practice questions and check their answers.

- Base your explanations on the lesson. You may add general background, but say when something goes beyond it.
- If they ask you to do graded assignment work for them, help them understand the approach instead of writing the answer.
- Keep replies focused and short enough to read in a chat. Markdown is supported.`,
    context: `Module: ${found.module.title}\nLesson: ${found.lesson.title}\n${found.lesson.summary ? `Summary: ${found.lesson.summary}\n` : ""}\nLesson content:\n${found.lesson.content || "(This lesson has no written content yet.)"}`,
    messages: trimChat(parsed.data),
    maxTokens: 4000,
  });
}

// ---------- Grading assistant (instructors) ----------

const gradeSchema = z.object({ score: z.number(), feedback: z.string().min(1) });

/** Suggests a score and feedback for the instructor to review; nothing is saved or sent. */
export async function draftGrade(submissionId: number): Promise<AiDraft> {
  const db = await getDb();
  const [row] = await db.select({ submission: submissions, assignment: assignments }).from(submissions).innerJoin(assignments, eq(assignments.id, submissions.assignmentId)).where(eq(submissions.id, submissionId));
  if (!row) return { error: "This submission no longer exists." };
  const user = await requireTeacher(row.assignment.cohortId);
  const limited = await aiQuota("grading", String(user.id), 60);
  if (limited) return { error: limited };
  const { submission, assignment } = row;
  if (!submission.body.trim() && !submission.linkUrl) return { error: "There's no written answer to read. The assistant can't open attached files, so please grade this one yourself." };

  const result = await askAi("grading", {
    system: `You help an instructor grade student work fairly and kindly. Read the assignment brief and the student's answer, then suggest a score out of ${assignment.maxScore} and written feedback addressed to the student.

- The feedback should say what they did well, what to improve, and one concrete next step. Use a few short paragraphs or bullets (Markdown).
- If the answer is incomplete or off-brief, score it accordingly and explain why.
- The instructor will review and edit your suggestion before the student sees it.`,
    messages: [{
      role: "user",
      content: `Assignment: ${assignment.title}\nMaximum score: ${assignment.maxScore}\n\nBrief:\n${assignment.instructions || "(no written brief)"}\n\nStudent's answer:\n${submission.body || "(no written answer)"}${submission.linkUrl ? `\n\nThey also shared a link (you can't open it): ${submission.linkUrl}` : ""}${submission.fileUrl ? `\n\nThey attached a file you can't see: ${submission.fileName ?? "file"}. Mention that the instructor should check it.` : ""}`,
    }],
    schema: {
      type: "object",
      properties: {
        score: { type: "integer", description: `Suggested score from 0 to ${assignment.maxScore}` },
        feedback: { type: "string", description: "Feedback to the student in Markdown" },
      },
      required: ["score", "feedback"],
      additionalProperties: false,
    },
  });
  if ("error" in result) return result;
  let parsed: z.infer<typeof gradeSchema>;
  try {
    const checked = gradeSchema.safeParse(JSON.parse(result.text));
    if (!checked.success) return { error: "The assistant's suggestion was incomplete. Please try again." };
    parsed = checked.data;
  } catch {
    return { error: "The assistant's suggestion was incomplete. Please try again." };
  }
  return { fields: { score: String(Math.max(0, Math.min(assignment.maxScore, Math.round(parsed.score)))), feedback: parsed.feedback } };
}

// ---------- Writing helper (admins and instructors) ----------

export type WritingKind = "description" | "outcomes" | "curriculum";

const WRITING: Record<WritingKind, { field: string; ask: string }> = {
  description: { field: "description", ask: "Write the full course page description in Markdown: an engaging opening paragraph, ## headings for who it's for and what they'll do, and short bullet lists. 200–350 words. No title heading." },
  outcomes: { field: "outcomes", ask: "Write 5 to 7 learning outcomes, one per line, each starting with a verb (e.g. 'Build interactive dashboards in Power BI'). No bullets or numbering." },
  curriculum: { field: "curriculum", ask: "Write a week-by-week curriculum, one module per line in the form: Module title | one-sentence description. Match the number of lines to the duration in weeks if given (otherwise 6–10). No numbering or bullets." },
};

/** Drafts course page copy from what's already in the course form. */
export async function draftCourseText(kind: WritingKind, values: Record<string, string>): Promise<AiDraft> {
  const admin = await requireRole("admin");
  const limited = await aiQuota("writing", String(admin.id), 60);
  if (limited) return { error: limited };
  const v = (name: string) => String(values[name] ?? "").trim().slice(0, 6000);
  if (!v("title")) return { error: "Add a title first, so the assistant knows what to write about." };
  const settings = await getSettings();
  const result = await askAi("writing", {
    system: `You write clear, persuasive, honest copy for ${settings.siteName}, a tech training academy with live online, in-person and hybrid cohorts. Plain British English, no hype or buzzwords, no invented facts (prices, dates, statistics, accreditation). Reply with only the requested text, ready to paste.`,
    messages: [{
      role: "user",
      content: `${WRITING[kind].ask}\n\nProgramme details so far:\nType: ${v("kind") === "internship" ? "Internship programme" : "Course"}\nTitle: ${v("title")}\nSummary: ${v("summary") || "(none)"}\nLevel: ${v("level") || "(not set)"}\nDuration (weeks): ${v("durationWeeks") || "(not set)"}\nCategory: ${v("category") || "(not set)"}\nExisting description: ${v("description") || "(none)"}\nExisting outcomes: ${v("outcomes") || "(none)"}\nExisting curriculum: ${v("curriculum") || "(none)"}\nJob roles: ${v("jobRoles") || "(none)"}`,
    }],
    maxTokens: 4000,
  });
  return "error" in result ? result : { fields: { [WRITING[kind].field]: result.text } };
}

/** Drafts an announcement message from its title and any notes already typed. */
export async function draftAnnouncement(cohortId: number, values: Record<string, string>): Promise<AiDraft> {
  const user = await requireTeacher(cohortId);
  const limited = await aiQuota("writing", String(user.id), 60);
  if (limited) return { error: limited };
  const title = String(values.title ?? "").trim().slice(0, 300);
  const notes = String(values.body ?? "").trim().slice(0, 4000);
  if (!title && !notes) return { error: "Add a title or a few notes first." };
  const db = await getDb();
  const [found] = await db.select({ course: courses.title, cohort: cohorts.name }).from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(eq(cohorts.id, cohortId));
  const result = await askAi("writing", {
    system: "You write short, warm, clear announcements from an instructor to their class. Plain British English, Markdown allowed, no invented facts (dates, links, times). Reply with only the message body.",
    messages: [{ role: "user", content: `Class: ${found?.course ?? ""} (${found?.cohort ?? ""})\nAnnouncement title: ${title || "(none)"}\nNotes to turn into the message: ${notes || "(none: write it from the title)"}` }],
    maxTokens: 2000,
  });
  return "error" in result ? result : { fields: { body: result.text } };
}

/** Rewrites an email template's body, keeping its {{placeholders}}. */
export async function draftEmailTemplate(key: string, values: Record<string, string>): Promise<AiDraft> {
  const admin = await requireRole("admin");
  if (!isTemplateKey(key)) return { error: "Unknown template." };
  const limited = await aiQuota("writing", String(admin.id), 60);
  if (limited) return { error: limited };
  const def = EMAIL_TEMPLATES[key];
  const variables = Object.keys({ ...COMMON_VARIABLES, ...def.variables });
  const result = await askAi("writing", {
    system: `You improve transactional emails for a tech training academy: clearer, friendlier and shorter, in plain British English. Keep the same purpose and every piece of information. Keep {{placeholders}} exactly as written (only these exist: ${variables.map((v) => `{{${v}}}`).join(", ")}). Keep button lines of the form [[Label|{{url}}]] on their own line. Markdown allowed. Reply with only the new body.`,
    messages: [{ role: "user", content: `Email: ${def.name} (${def.description})\nSubject: ${String(values.subject ?? "").slice(0, 300)}\n\nCurrent body:\n${String(values.body ?? "").slice(0, 8000)}` }],
    maxTokens: 4000,
  });
  return "error" in result ? result : { fields: { body: result.text } };
}

const lessonDraftSchema = z.object({ summary: z.string(), content: z.string(), estimatedMinutes: z.number().int() });

/**
 * Drafts a lesson from its title (and summary, if one's written): a one-line summary and the full lesson
 * content in Markdown. Uses the course and module for context, and the module's other lessons to avoid overlap.
 */
export async function draftLesson(moduleId: number, lessonId: number | null, values: Record<string, string>): Promise<AiDraft> {
  const db = await getDb();
  const [found] = await db.select({ module: courseModules, course: courses }).from(courseModules).innerJoin(courses, eq(courses.id, courseModules.courseId)).where(eq(courseModules.id, moduleId));
  if (!found) return { error: "This module no longer exists." };
  const user = await requireCourseEditor(found.course.id);
  const limited = await aiQuota("writing", String(user.id), 60);
  if (limited) return { error: limited };
  const title = String(values.title ?? "").trim().slice(0, 200);
  if (!title) return { error: "Add the lesson title first, so the draft knows what to cover." };
  const summary = String(values.summary ?? "").trim().slice(0, 600);
  const siblings = (await db.select({ id: lessons.id, title: lessons.title }).from(lessons).where(eq(lessons.moduleId, moduleId))).filter((l) => l.id !== lessonId).map((l) => l.title);

  const result = await askAi("writing", {
    system: [
      "You write lessons for a live, instructor-led tech training academy. Students are adults, often beginners changing career; many are in Nigeria and the UK.",
      "Write in plain British English: clear, friendly and practical. Explain ideas simply before using jargon, and define terms the first time they appear.",
      "The lesson content is Markdown: short sections with ## headings, short paragraphs, bullet points where they help, and at least one worked example.",
      "Use fenced code blocks with a language tag (for example ```sql) whenever code, formulas or queries are involved, and keep examples realistic (sales, customers, staff, orders).",
      "End with a '## Key points' recap (3–5 bullets) and a '## Try it yourself' task the student can do in a few minutes.",
      "Aim for about 600–1,000 words. Don't invent facts about the academy, dates or links, and don't mention a video.",
      "The summary is one or two sentences saying what the student will learn, for the module outline.",
      "estimatedMinutes is how long a typical student needs to read and try the lesson.",
    ].join(" "),
    messages: [{
      role: "user",
      content: [
        `Course: ${found.course.title}${found.course.level ? ` (${found.course.level})` : ""}`,
        `Module: ${found.module.title}${found.module.summary ? ` — ${found.module.summary}` : ""}`,
        siblings.length ? `Other lessons in this module (don't repeat them): ${siblings.join("; ")}` : "",
        `Lesson title: ${title}`,
        summary ? `The instructor's summary (follow it closely): ${summary}` : "",
      ].filter(Boolean).join("\n"),
    }],
    schema: {
      type: "object",
      properties: { summary: { type: "string" }, content: { type: "string" }, estimatedMinutes: { type: "integer" } },
      required: ["summary", "content", "estimatedMinutes"],
      additionalProperties: false,
    },
    maxTokens: 6000,
  });
  if ("error" in result) return result;
  let draft: z.infer<typeof lessonDraftSchema>;
  try {
    const parsed = lessonDraftSchema.safeParse(JSON.parse(result.text));
    if (!parsed.success) return { error: "The draft came back incomplete. Please try again." };
    draft = parsed.data;
  } catch {
    return { error: "The draft came back incomplete. Please try again." };
  }
  // A summary the instructor already wrote is kept; only empty fields and the content are filled.
  return {
    fields: {
      ...(summary ? {} : { summary: draft.summary.trim().slice(0, 600) }),
      content: draft.content.trim(),
      estimatedMinutes: String(Math.min(180, Math.max(5, draft.estimatedMinutes))),
    },
  };
}
