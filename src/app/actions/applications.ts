"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { cohorts, courses, internshipApplications, users } from "@/db/schema";
import { CURRENT_STATUSES, EXPERIENCE_LEVELS, HEARD_FROM, HOURS_PER_WEEK, MOTIVATION_MAX } from "@/lib/applications";
import { requireRole } from "@/lib/auth";
import { countryByCode } from "@/lib/countries";
import { getAdmins, getCohortWithCourse, graduateFor, isGraduate } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { loginBlockedFor, recordLoginFailure } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/site";
import { saveUpload } from "@/lib/storage";
import { uploadErrorMessage } from "@/lib/upload-field";
import { firstName, QUALIFICATIONS } from "@/lib/utils";
import { dialCode, email, firstError, formatPhone, formValues, optionalUrl, phoneNumber, required, text, type FormState } from "@/lib/validation";

const oneOf = <T extends readonly string[]>(list: T, message: string) => z.string().refine((v): v is T[number] => (list as readonly string[]).includes(v), message);

const applicationSchema = z.object({
  name: required("Full name", 120),
  email,
  dialCode,
  phone: phoneNumber,
  country: z.string().trim().toUpperCase().refine((v) => Boolean(countryByCode(v)), "Choose the country you live in."),
  city: required("City", 80),
  graduateClaimed: z.enum(["yes", "no"], { message: "Tell us whether you've completed a course with us." }),
  qualification: z.string().refine((v) => v === "" || (QUALIFICATIONS as readonly string[]).includes(v), "Choose a qualification from the list."),
  currentStatus: oneOf(CURRENT_STATUSES, "Tell us what you're doing at the moment."),
  skillArea: required("Skill area", 160),
  experience: oneOf(EXPERIENCE_LEVELS, "Choose your experience level."),
  preferredCohortId: z.string().trim().refine((v) => v === "" || /^\d+$/.test(v), "Choose an intake."),
  mode: z.enum(["remote", "in_person", "either"], { message: "Choose how you'd like to work." }),
  hoursPerWeek: oneOf(HOURS_PER_WEEK, "Choose how many hours a week you can commit."),
  portfolioUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  motivation: z.string().trim().min(30, "Tell us a little more about why you'd like to join (at least a couple of sentences).").max(MOTIVATION_MAX, `Keep this under ${MOTIVATION_MAX} characters.`),
  heardFrom: z.string().refine((v) => v === "" || (HEARD_FROM as readonly string[]).includes(v), "Choose where you heard about us."),
  website: text(200),
});

export type ApplicationState = { error?: string } | undefined;

/** The public "Join our internship programme" form. */
export async function submitApplication(_state: ApplicationState, formData: FormData): Promise<ApplicationState> {
  const parsed = applicationSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;
  // Bots fill the hidden "website" field; pretend it worked.
  if (data.website) redirect("/internships/apply/thanks");
  if (formData.get("isAdult") !== "on") return { error: "You need to be 18 or older to apply." };
  if (formData.get("consent") !== "on") return { error: "Please agree to the privacy policy so we can process your application." };

  const wait = await loginBlockedFor(data.email, "apply");
  if (wait) return { error: `Too many attempts. Please try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  await recordLoginFailure(data.email, "apply");

  const db = await getDb();
  const [open] = await db.select({ id: internshipApplications.id }).from(internshipApplications).where(and(eq(internshipApplications.email, data.email), inArray(internshipApplications.status, ["new", "shortlisted"])));
  if (open) return { error: "You already have an application under review. We'll email you as soon as there's news." };

  let cvUrl: string | null = null;
  const cv = formData.get("cv");
  if (cv instanceof File && cv.size > 0) {
    if (!/\.(pdf|docx?)$/i.test(cv.name)) return { error: "Upload your CV as a PDF or Word document." };
    try {
      cvUrl = await saveUpload(cv, "applications", "document");
    } catch (error) {
      const message = uploadErrorMessage(error);
      if (message) return { error: message };
      throw error;
    }
  }

  // Only intakes that are real, open internship cohorts are kept.
  let preferredCohortId: number | null = null;
  if (data.preferredCohortId) {
    const [row] = await db.select({ id: cohorts.id }).from(cohorts).innerJoin(courses, eq(courses.id, cohorts.courseId)).where(and(eq(cohorts.id, Number(data.preferredCohortId)), eq(courses.kind, "internship")));
    preferredCohortId = row?.id ?? null;
  }
  // "I'm a graduate" is checked against the academy's own records for that email: the chosen
  // internship's linked courses, or any course when they're not sure which internship.
  const [account] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email));
  const [programme] = await db.select({ id: courses.id }).from(courses).where(and(eq(courses.kind, "internship"), eq(courses.title, data.skillArea)));
  const graduateVerified = data.graduateClaimed === "yes" && account ? await (programme ? graduateFor(account.id, programme.id) : isGraduate(account.id)) : false;

  const [application] = await db.insert(internshipApplications).values({
    name: data.name,
    email: data.email,
    phone: formatPhone(data.dialCode, data.phone),
    country: data.country,
    city: data.city,
    graduateClaimed: data.graduateClaimed === "yes",
    graduateVerified,
    qualification: data.qualification,
    currentStatus: data.currentStatus,
    skillArea: data.skillArea,
    experience: data.experience,
    preferredCohortId,
    mode: data.mode,
    hoursPerWeek: data.hoursPerWeek,
    hasLaptop: formData.get("hasLaptop") === "on",
    hasInternet: formData.get("hasInternet") === "on",
    portfolioUrl: data.portfolioUrl || null,
    linkedinUrl: data.linkedinUrl || null,
    cvUrl,
    motivation: data.motivation,
    heardFrom: data.heardFrom,
    isAdult: true,
    consentAt: new Date(),
  }).returning({ id: internshipApplications.id });

  await sendEmail(data.email, "application_received", { name: firstName(data.name), programme: data.skillArea });
  await notify((await getAdmins()).map((a) => a.id), {
    kind: "application",
    title: `New internship application: ${data.name}`,
    body: `${data.skillArea} · ${countryByCode(data.country)?.name ?? data.country}${graduateVerified ? " · verified graduate" : ""}`,
    href: `/admin/applications/${application.id}`,
  });
  revalidatePath("/admin/applications");
  redirect("/internships/apply/thanks");
}

// ---------- Admin review ----------

async function loadApplication(id: number) {
  const [application] = await (await getDb()).select().from(internshipApplications).where(eq(internshipApplications.id, id));
  return application ?? null;
}

export async function saveApplicationNotes(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const notes = String(formData.get("adminNotes") ?? "").trim().slice(0, 5000);
  await (await getDb()).update(internshipApplications).set({ adminNotes: notes }).where(eq(internshipApplications.id, id));
  revalidatePath(`/admin/applications/${id}`);
  return { ok: "Notes saved." };
}

export async function shortlistApplication(id: number): Promise<void> {
  const admin = await requireRole("admin");
  await (await getDb()).update(internshipApplications).set({ status: "shortlisted", decidedById: admin.id }).where(eq(internshipApplications.id, id));
  revalidatePath("/admin/applications", "layout");
}

/** Accepts an applicant and emails them a link to enrol on the chosen intake (free for verified graduates when the intake allows). */
export async function acceptApplication(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const application = await loadApplication(id);
  if (!application) return { error: "This application no longer exists." };
  const cohortId = Number(formData.get("cohortId"));
  const found = Number.isInteger(cohortId) && cohortId > 0 ? await getCohortWithCourse(cohortId) : null;
  if (!found || found.course.kind !== "internship") return { error: "Choose the internship intake to invite them to." };
  await (await getDb()).update(internshipApplications).set({ status: "accepted", acceptedCohortId: cohortId, decidedById: admin.id, decidedAt: new Date() }).where(eq(internshipApplications.id, id));
  await sendEmail(application.email, "application_accepted", {
    name: firstName(application.name),
    programme: found.course.title,
    intake: found.cohort.name,
    enrolUrl: absoluteUrl(`/enroll?cohort=${cohortId}`),
  });
  revalidatePath("/admin/applications", "layout");
  return { ok: `Accepted. ${application.name} has been emailed a link to enrol on ${found.cohort.name}.` };
}

export async function rejectApplication(id: number): Promise<void> {
  const admin = await requireRole("admin");
  const application = await loadApplication(id);
  if (!application || application.status === "rejected") return;
  await (await getDb()).update(internshipApplications).set({ status: "rejected", decidedById: admin.id, decidedAt: new Date() }).where(eq(internshipApplications.id, id));
  await sendEmail(application.email, "application_rejected", { name: firstName(application.name), programme: application.skillArea });
  revalidatePath("/admin/applications", "layout");
}
