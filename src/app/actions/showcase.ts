"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { assignments, cohorts, showcaseProjects, submissions } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireTeacher, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { parseTools } from "@/lib/showcase";
import { absoluteUrl } from "@/lib/site";
import { deleteIfReplaced } from "@/lib/storage";
import { resolveFileField, uploadErrorMessage } from "@/lib/upload-field";
import { slugify } from "@/lib/utils";
import { firstError, formValues, optionalUrl, required, type FormState } from "@/lib/validation";

const revalidate = () => {
  revalidatePath("/projects", "layout");
  revalidatePath("/dashboard/showcase", "layout");
  revalidatePath("/admin/showcase");
  revalidatePath("/");
};

/** A readable, unique address: the title plus a short random tail. */
const projectSlug = (title: string) => `${slugify(title).slice(0, 60) || "project"}-${randomBytes(2).toString("hex")}`;

// ---------- Instructor ----------

/** Invites the student to publish a graded submission. The student decides whether it goes live. */
export async function inviteToShowcase(submissionId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const db = await getDb();
  const [row] = await db.select({ submission: submissions, assignment: assignments, courseId: cohorts.courseId }).from(submissions).innerJoin(assignments, eq(assignments.id, submissions.assignmentId)).innerJoin(cohorts, eq(cohorts.id, assignments.cohortId)).where(eq(submissions.id, submissionId));
  if (!row) return { error: "This submission no longer exists." };
  const teacher = await requireTeacher(row.assignment.cohortId);
  if (row.submission.status !== "graded") return { error: "Grade the work before inviting it to the showcase." };
  const [existing] = await db.select({ id: showcaseProjects.id }).from(showcaseProjects).where(eq(showcaseProjects.submissionId, submissionId));
  if (existing) return { error: "This work has already been invited." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const [project] = await db.insert(showcaseProjects).values({
    slug: projectSlug(row.assignment.title),
    submissionId,
    userId: row.submission.userId,
    courseId: row.courseId,
    title: row.assignment.title,
    linkUrl: row.submission.linkUrl,
    inviteNote: note,
    invitedById: teacher.id,
  }).returning({ id: showcaseProjects.id });
  await notify([row.submission.userId], {
    kind: "showcase",
    title: `Your work on ${row.assignment.title} was picked for the showcase`,
    body: "Review it and choose whether to publish it on the Projects page.",
    href: `/dashboard/showcase/${project.id}`,
    email: {
      template: "showcase_invite",
      vars: { assignmentTitle: row.assignment.title, instructorName: teacher.name, note: note ? `> ${note.replace(/\n+/g, " ")}` : "", showcaseUrl: absoluteUrl(`/dashboard/showcase/${project.id}`) },
    },
  });
  revalidatePath(`/teach/submissions/${submissionId}`);
  revalidate();
  return { ok: "Invitation sent. The student chooses whether to publish it." };
}

// ---------- Student ----------

async function ownProject(id: number) {
  const user = await requireUser();
  const [project] = await (await getDb()).select().from(showcaseProjects).where(and(eq(showcaseProjects.id, id), eq(showcaseProjects.userId, user.id)));
  return project ? { user, project } : null;
}

const projectSchema = z.object({
  title: required("Project title", 120),
  summary: z.string().trim().min(40, "Describe your project in a few sentences: the problem, what you built and what you found.").max(1500, "Keep the description under 1,500 characters."),
  linkUrl: optionalUrl,
  intent: z.enum(["save", "publish"]).catch("save"),
});

/** Saves the student's edits and, with "Publish", puts the project on the public Projects page. */
export async function saveShowcaseProject(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const owned = await ownProject(id);
  if (!owned) return { error: "This project no longer exists." };
  const { project } = owned;
  if (project.status === "hidden") return { error: "The team has hidden this project. Contact us if you'd like it back." };
  const parsed = projectSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;
  let imageUrl: string | null;
  try {
    imageUrl = await resolveFileField(formData, { file: "image", remove: "removeImage", current: project.imageUrl, folder: "images" });
  } catch (error) {
    const message = uploadErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }
  const publish = data.intent === "publish" || project.status === "published";
  if (publish && !imageUrl && !data.linkUrl) return { error: "Add a cover image or a link to your project before publishing, so visitors can see your work." };
  await (await getDb()).update(showcaseProjects).set({
    // The address follows the student's own title the first time it goes live, then stays put so shared links keep working.
    ...(publish && !project.publishedAt ? { slug: projectSlug(data.title) } : {}),
    title: data.title,
    summary: data.summary,
    tools: parseTools(formData.get("tools")),
    linkUrl: data.linkUrl || null,
    imageUrl,
    status: publish ? "published" : project.status === "declined" ? "invited" : project.status,
    publishedAt: publish ? project.publishedAt ?? new Date() : project.publishedAt,
    updatedAt: new Date(),
  }).where(eq(showcaseProjects.id, id));
  await deleteIfReplaced(project.imageUrl, imageUrl);
  revalidate();
  if (data.intent === "publish" && project.status !== "published") redirect(`/dashboard/showcase/${id}?published=1`);
  return { ok: publish ? "Saved. Your changes are live on the Projects page." : "Saved. Publish it when you're happy with it." };
}

/** Declines the invitation, or takes a published project down. Either can be reversed by publishing later. */
export async function withdrawShowcaseProject(id: number): Promise<void> {
  const owned = await ownProject(id);
  if (!owned || owned.project.status === "hidden") return;
  await (await getDb()).update(showcaseProjects).set({ status: "declined", updatedAt: new Date() }).where(eq(showcaseProjects.id, id));
  revalidate();
}

// ---------- Team ----------

export async function setShowcaseHidden(id: number, hidden: boolean): Promise<void> {
  const actor = await requirePermission("showcase.manage");
  const db = await getDb();
  const [project] = await db.select().from(showcaseProjects).where(eq(showcaseProjects.id, id));
  if (!project) return;
  // Restoring puts it back as it was before: published if it ever was.
  await db.update(showcaseProjects).set({ status: hidden ? "hidden" : project.publishedAt ? "published" : "invited", updatedAt: new Date() }).where(eq(showcaseProjects.id, id));
  await logAudit(actor, { action: hidden ? "showcase.hidden" : "showcase.restored", summary: `${hidden ? "hid" : "restored"} the showcase project “${project.title}”`, target: { type: "showcase_project", id } });
  revalidate();
}
