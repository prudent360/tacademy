"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { instructorApplications, users } from "@/db/schema";
import { AVAILABILITY, HEARD_FROM, TEACHING_EXPERIENCE, TOPICS_MAX, YEARS_EXPERIENCE } from "@/lib/applications";
import { requireRole } from "@/lib/auth";
import { countryByCode } from "@/lib/countries";
import { getAdmins } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { loginBlockedFor, recordLoginFailure } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/site";
import { saveUpload } from "@/lib/storage";
import { issueToken } from "@/lib/tokens";
import { uploadErrorMessage } from "@/lib/upload-field";
import { firstName } from "@/lib/utils";
import { dialCode, email, firstError, formatPhone, formValues, optionalUrl, phoneNumber, required, text, type FormState } from "@/lib/validation";

const oneOf = <T extends readonly string[]>(list: T, message: string) => z.string().refine((v): v is T[number] => (list as readonly string[]).includes(v), message);

const schema = z.object({
  name: required("Full name", 120),
  email,
  dialCode,
  phone: phoneNumber,
  country: z.string().trim().toUpperCase().refine((v) => Boolean(countryByCode(v)), "Choose the country you live in."),
  city: required("City", 80),
  currentRole: required("Current role", 160),
  expertise: required("Area of expertise", 160),
  yearsExperience: oneOf(YEARS_EXPERIENCE, "Choose how many years you've worked in this area."),
  teachingExperience: oneOf(TEACHING_EXPERIENCE, "Tell us about your teaching experience."),
  mode: z.enum(["remote", "in_person", "either"], { message: "Choose how you'd like to teach." }),
  availability: oneOf(AVAILABILITY, "Choose when you're usually available."),
  topics: z.string().trim().min(30, "Tell us a little more about what you'd teach (at least a couple of sentences).").max(TOPICS_MAX, `Keep this under ${TOPICS_MAX} characters.`),
  linkedinUrl: z.string().trim().min(1, "Add your LinkedIn profile so we can see your experience.").pipe(optionalUrl),
  portfolioUrl: optionalUrl,
  heardFrom: z.string().refine((v) => v === "" || (HEARD_FROM as readonly string[]).includes(v), "Choose where you heard about us."),
  website: text(200),
});

export type InstructorApplicationState = { error?: string } | undefined;

/** The public "Become an instructor" form. */
export async function submitInstructorApplication(_state: InstructorApplicationState, formData: FormData): Promise<InstructorApplicationState> {
  const parsed = schema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;
  // Bots fill the hidden "website" field; pretend it worked.
  if (data.website) redirect("/teach-with-us/apply/thanks");
  if (formData.get("consent") !== "on") return { error: "Please agree to the privacy policy so we can process your application." };

  const wait = await loginBlockedFor(data.email, "apply");
  if (wait) return { error: `Too many attempts. Please try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  await recordLoginFailure(data.email, "apply");

  const db = await getDb();
  const [open] = await db.select({ id: instructorApplications.id }).from(instructorApplications).where(and(eq(instructorApplications.email, data.email), inArray(instructorApplications.status, ["new", "shortlisted"])));
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

  const [application] = await db.insert(instructorApplications).values({
    name: data.name,
    email: data.email,
    phone: formatPhone(data.dialCode, data.phone),
    country: data.country,
    city: data.city,
    currentRole: data.currentRole,
    expertise: data.expertise,
    yearsExperience: data.yearsExperience,
    teachingExperience: data.teachingExperience,
    mode: data.mode,
    availability: data.availability,
    topics: data.topics,
    linkedinUrl: data.linkedinUrl || null,
    portfolioUrl: data.portfolioUrl || null,
    cvUrl,
    heardFrom: data.heardFrom,
    consentAt: new Date(),
  }).returning({ id: instructorApplications.id });

  await sendEmail(data.email, "instructor_application_received", { name: firstName(data.name), expertise: data.expertise });
  await notify((await getAdmins()).map((a) => a.id), {
    kind: "application",
    title: `New instructor application: ${data.name}`,
    body: `${data.expertise} · ${data.yearsExperience} · ${countryByCode(data.country)?.name ?? data.country}`,
    href: `/admin/instructor-applications/${application.id}`,
  });
  revalidatePath("/admin/instructor-applications");
  redirect("/teach-with-us/apply/thanks");
}

// ---------- Admin review ----------

async function load(id: number) {
  const [application] = await (await getDb()).select().from(instructorApplications).where(eq(instructorApplications.id, id));
  return application ?? null;
}

export async function saveInstructorApplicationNotes(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const notes = String(formData.get("adminNotes") ?? "").trim().slice(0, 5000);
  await (await getDb()).update(instructorApplications).set({ adminNotes: notes }).where(eq(instructorApplications.id, id));
  revalidatePath(`/admin/instructor-applications/${id}`);
  return { ok: "Notes saved." };
}

export async function shortlistInstructorApplication(id: number): Promise<void> {
  const admin = await requireRole("admin");
  await (await getDb()).update(instructorApplications).set({ status: "shortlisted", decidedById: admin.id }).where(eq(instructorApplications.id, id));
  revalidatePath("/admin/instructor-applications", "layout");
}

/**
 * Accepts an applicant: creates an instructor account (or makes an existing student account an instructor)
 * and emails them a link to set their password or sign in. Admin accounts are left as they are.
 */
export async function acceptInstructorApplication(id: number): Promise<FormState> {
  const admin = await requireRole("admin");
  const application = await load(id);
  if (!application) return { error: "This application no longer exists." };
  if (application.status === "accepted") return { ok: "Already accepted." };
  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, application.email));
  let userId: number;
  let accountUrl: string;
  let buttonLabel: string;
  if (existing) {
    userId = existing.id;
    if (existing.role === "student") await db.update(users).set({ role: "instructor" }).where(eq(users.id, existing.id));
    if (existing.passwordHash) {
      accountUrl = absoluteUrl("/login");
      buttonLabel = "Sign in to your account";
    } else {
      accountUrl = absoluteUrl(`/reset-password?token=${await issueToken(existing.id, "invite")}`);
      buttonLabel = "Set up my instructor account";
    }
  } else {
    const [user] = await db.insert(users).values({ name: application.name, email: application.email, phone: application.phone, country: application.country, role: "instructor", passwordHash: null }).returning({ id: users.id });
    userId = user.id;
    accountUrl = absoluteUrl(`/reset-password?token=${await issueToken(user.id, "invite")}`);
    buttonLabel = "Set up my instructor account";
  }
  await db.update(instructorApplications).set({ status: "accepted", userId, decidedById: admin.id, decidedAt: new Date() }).where(eq(instructorApplications.id, id));
  await sendEmail(application.email, "instructor_application_accepted", { name: firstName(application.name), accountUrl, buttonLabel });
  revalidatePath("/admin/instructor-applications", "layout");
  revalidatePath("/admin/users");
  return { ok: `Accepted. ${application.name} now has an instructor account and has been emailed a link to ${existing?.passwordHash ? "sign in" : "set their password"}. Assign them to a cohort from the cohort's settings.` };
}

export async function rejectInstructorApplication(id: number): Promise<void> {
  const admin = await requireRole("admin");
  const application = await load(id);
  if (!application || application.status === "rejected" || application.status === "accepted") return;
  await (await getDb()).update(instructorApplications).set({ status: "rejected", decidedById: admin.id, decidedAt: new Date() }).where(eq(instructorApplications.id, id));
  await sendEmail(application.email, "instructor_application_rejected", { name: firstName(application.name), expertise: application.expertise });
  revalidatePath("/admin/instructor-applications", "layout");
}
