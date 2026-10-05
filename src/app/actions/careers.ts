"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { JOB_APPLICATION_STATUSES, JOB_MODES, JOB_STATUSES, JOB_TYPES, jobApplications, jobOpenings } from "@/db/schema";
import { HEARD_FROM } from "@/lib/applications";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { isAccepting, JOB_APPLICATION_LABEL, NOTICE_PERIODS, parseLines } from "@/lib/careers";
import { countryByCode } from "@/lib/countries";
import { getAdmins } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { loginBlockedFor, recordLoginFailure } from "@/lib/rate-limit";
import { saveUpload } from "@/lib/storage";
import { uploadErrorMessage } from "@/lib/upload-field";
import { firstName, slugify } from "@/lib/utils";
import { dateValue, dialCode, email, firstError, formatPhone, formValues, optionalUrl, phoneNumber, required, sortValue, text, type FormState } from "@/lib/validation";

// ---------- Openings (admin) ----------

const jobSchema = z.object({
  title: required("Job title", 120),
  slug: text(80),
  department: text(60),
  location: text(80),
  workMode: z.enum(JOB_MODES),
  employmentType: z.enum(JOB_TYPES),
  salary: text(120),
  summary: required("Short summary", 300),
  description: text(20_000),
  applyMethod: z.enum(["form", "email", "link"]),
  applyTarget: text(500),
  status: z.enum(JOB_STATUSES),
  closesOn: dateValue,
  sortOrder: sortValue,
});

export async function saveJob(id: number | null, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("careers.manage");
  const parsed = jobSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;
  if (data.applyMethod === "email" && !z.email().safeParse(data.applyTarget).success) return { error: "Enter the email address applications should go to." };
  if (data.applyMethod === "link" && !/^https?:\/\//i.test(data.applyTarget)) return { error: "Enter the full link to apply, starting with https://." };
  const slug = slugify(data.slug || data.title);
  if (!slug) return { error: "Add a title with letters or numbers." };
  const db = await getDb();
  const [clash] = await db.select({ id: jobOpenings.id }).from(jobOpenings).where(id ? and(eq(jobOpenings.slug, slug), ne(jobOpenings.id, id)) : eq(jobOpenings.slug, slug));
  if (clash) return { error: `Another role already uses the address /careers/${slug}. Change the title or the web address.` };
  const [before] = id ? await db.select().from(jobOpenings).where(eq(jobOpenings.id, id)) : [];
  const values = {
    ...data,
    slug,
    applyTarget: data.applyMethod === "form" ? "" : data.applyTarget,
    closesOn: data.closesOn || null,
    responsibilities: parseLines(formData.get("responsibilities")),
    requirements: parseLines(formData.get("requirements")),
    niceToHave: parseLines(formData.get("niceToHave")),
    benefits: parseLines(formData.get("benefits")),
    // First time it goes live, for "Posted" dates and Google Jobs.
    publishedAt: data.status === "open" ? before?.publishedAt ?? new Date() : before?.publishedAt ?? null,
    updatedAt: new Date(),
  };
  let jobId = id;
  if (id) {
    await db.update(jobOpenings).set(values).where(eq(jobOpenings.id, id));
  } else {
    const [created] = await db.insert(jobOpenings).values(values).returning({ id: jobOpenings.id });
    jobId = created.id;
  }
  await logAudit(actor, { action: id ? "job.updated" : "job.created", summary: `${id ? "updated" : "created"} the role “${data.title}”${before?.status !== data.status ? ` (${data.status})` : ""}`, target: { type: "job", id: jobId! } });
  revalidatePath("/careers", "layout");
  revalidatePath("/admin/careers", "layout");
  if (!id) redirect(`/admin/careers/${jobId}?created=1`);
  return { ok: data.status === "open" ? "Saved. The role is live on the Careers page." : data.status === "draft" ? "Saved as a draft. Only the team can see it." : "Saved. The role is closed to new applications." };
}

export async function setJobStatus(id: number, status: (typeof JOB_STATUSES)[number]): Promise<void> {
  const actor = await requirePermission("careers.manage");
  const db = await getDb();
  const [job] = await db.select().from(jobOpenings).where(eq(jobOpenings.id, id));
  if (!job) return;
  await db.update(jobOpenings).set({ status, publishedAt: status === "open" ? job.publishedAt ?? new Date() : job.publishedAt, updatedAt: new Date() }).where(eq(jobOpenings.id, id));
  await logAudit(actor, { action: "job.status", summary: `${status === "open" ? "opened" : status === "closed" ? "closed" : "unpublished"} the role “${job.title}”`, target: { type: "job", id } });
  revalidatePath("/careers", "layout");
  revalidatePath("/admin/careers", "layout");
}

/** Deletes a role. Its applications are kept (they remember the job title). */
export async function deleteJob(id: number): Promise<void> {
  const actor = await requirePermission("careers.manage");
  const [job] = await (await getDb()).delete(jobOpenings).where(eq(jobOpenings.id, id)).returning();
  if (job) await logAudit(actor, { action: "job.deleted", summary: `deleted the role “${job.title}”`, target: { type: "job", id } });
  revalidatePath("/careers", "layout");
  revalidatePath("/admin/careers", "layout");
  redirect("/admin/careers");
}

// ---------- Applying (public) ----------

const applySchema = z.object({
  name: required("Full name", 120),
  email,
  dialCode,
  phone: phoneNumber,
  country: z.string().trim().toUpperCase().refine((v) => Boolean(countryByCode(v)), "Choose the country you live in."),
  city: text(80),
  linkedinUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  coverLetter: z.string().trim().min(40, "Tell us a little about why you're a good fit (a few sentences).").max(5000, "Keep your note under 5,000 characters."),
  salaryExpectation: text(120),
  noticePeriod: z.string().refine((v) => v === "" || (NOTICE_PERIODS as readonly string[]).includes(v), "Choose when you could start."),
  heardFrom: z.string().refine((v) => v === "" || (HEARD_FROM as readonly string[]).includes(v), "Choose where you heard about us."),
  website: text(200),
});

export type JobApplyState = { error?: string } | undefined;

export async function applyForJob(jobId: number, _state: JobApplyState, formData: FormData): Promise<JobApplyState> {
  const db = await getDb();
  const [job] = await db.select().from(jobOpenings).where(eq(jobOpenings.id, jobId));
  if (!job || !isAccepting(job) || job.applyMethod !== "form") return { error: "This role isn't taking applications any more." };
  const parsed = applySchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;
  // Bots fill the hidden "website" field; pretend it worked.
  if (data.website) redirect(`/careers/${job.slug}?applied=1`);
  if (formData.get("consent") !== "on") return { error: "Please agree to the privacy policy so we can process your application." };

  const wait = await loginBlockedFor(data.email, "job");
  if (wait) return { error: `Too many attempts. Please try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  await recordLoginFailure(data.email, "job");

  const [already] = await db.select({ id: jobApplications.id }).from(jobApplications).where(and(eq(jobApplications.jobId, job.id), eq(jobApplications.email, data.email), inArray(jobApplications.status, ["new", "reviewing", "interview", "offer"])));
  if (already) return { error: "You've already applied for this role. We'll be in touch as soon as there's news." };

  const cv = formData.get("cv");
  if (!(cv instanceof File) || cv.size === 0) return { error: "Please attach your CV." };
  if (!/\.(pdf|docx?)$/i.test(cv.name)) return { error: "Upload your CV as a PDF or Word document." };
  let cvUrl: string;
  try {
    cvUrl = await saveUpload(cv, "applications", "document");
  } catch (error) {
    const message = uploadErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }

  const [application] = await db.insert(jobApplications).values({
    jobId: job.id,
    jobTitle: job.title,
    name: data.name,
    email: data.email,
    phone: formatPhone(data.dialCode, data.phone),
    country: data.country,
    city: data.city,
    linkedinUrl: data.linkedinUrl || null,
    portfolioUrl: data.portfolioUrl || null,
    cvUrl,
    coverLetter: data.coverLetter,
    salaryExpectation: data.salaryExpectation,
    noticePeriod: data.noticePeriod,
    heardFrom: data.heardFrom,
    consentAt: new Date(),
  }).returning({ id: jobApplications.id });

  await sendEmail(data.email, "job_application_received", { name: firstName(data.name), jobTitle: job.title });
  await notify((await getAdmins()).map((a) => a.id), {
    kind: "application",
    title: `New application: ${job.title}`,
    body: `${data.name} · ${countryByCode(data.country)?.name ?? data.country}`,
    href: `/admin/careers/applications/${application.id}`,
  });
  revalidatePath("/admin/careers", "layout");
  redirect(`/careers/${job.slug}?applied=1`);
}

// ---------- Applications (admin) ----------

export async function updateJobApplication(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("careers.manage");
  const status = JOB_APPLICATION_STATUSES.find((s) => s === formData.get("status"));
  if (!status) return { error: "Choose a stage." };
  const notes = String(formData.get("adminNotes") ?? "").trim().slice(0, 5000);
  const db = await getDb();
  const [before] = await db.select().from(jobApplications).where(eq(jobApplications.id, id));
  if (!before) return { error: "This application no longer exists." };
  await db.update(jobApplications).set({ status, adminNotes: notes, decidedById: actor.id, updatedAt: new Date() }).where(eq(jobApplications.id, id));
  const moved = status !== before.status;
  let emailed = false;
  if (moved && status === "rejected" && formData.get("notify") === "on") {
    await sendEmail(before.email, "job_application_unsuccessful", { name: firstName(before.name), jobTitle: before.jobTitle });
    emailed = true;
  }
  if (moved) await logAudit(actor, { action: "job_application.moved", summary: `moved ${before.name}'s application for ${before.jobTitle} to “${JOB_APPLICATION_LABEL[status]}”`, target: { type: "job_application", id } });
  revalidatePath("/admin/careers", "layout");
  return { ok: moved ? `Moved to “${JOB_APPLICATION_LABEL[status]}”${emailed ? " and emailed them" : ""}.` : "Saved." };
}
