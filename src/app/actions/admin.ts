"use server";

import { randomBytes } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  certificates, cohortInstructors, cohorts, courses, DELIVERY_MODES, discountCodes, emailTemplates, enrollments, payments, ROLES, users,
  type PriceMap, type Role,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getCohortWithCourse } from "@/lib/data";
import { REQUIRED_TEMPLATES, sendEmail } from "@/lib/email";
import { certificateEligibility } from "@/lib/certificates";
import { COMMON_VARIABLES, EMAIL_TEMPLATES, isTemplateKey } from "@/lib/email-templates";
import { CURRENCY_CODES, formatMoney, parseMajor } from "@/lib/money";
import { activateEnrollment, describePurchase, fulfilPayment, paymentBalanceFor, verifyPayment } from "@/lib/payments";
import { notify } from "@/lib/notify";
import { absoluteUrl } from "@/lib/site";
import { deleteIfReplaced, deleteUpload } from "@/lib/storage";
import { issueToken } from "@/lib/tokens";
import { resolveFileField, uploadErrorMessage } from "@/lib/upload-field";
import { firstName, parseList, slugify } from "@/lib/utils";
import { dateValue, email as emailSchema, firstError, formValues, required, sortValue, text, type FormState } from "@/lib/validation";

async function imageField(formData: FormData, file: string, remove: string, current: string | null, folder: "courses" | "branding"): Promise<{ url: string | null } | { error: string }> {
  try {
    return { url: await resolveFileField(formData, { file, remove, current, folder }) };
  } catch (error) {
    const message = uploadErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }
}

// ---------- Courses ----------

const courseSchema = z.object({
  title: required("Title", 160),
  slug: text(80),
  summary: required("Summary", 400),
  description: text(50_000),
  category: text(60),
  level: text(40),
  durationWeeks: z.string().trim().refine((v) => v === "" || /^\d{1,3}$/.test(v), "Duration must be a number of weeks."),
  sortOrder: sortValue,
  certificateMinAttendance: z.coerce.number().int().min(0).max(100),
  certificateMinAssignments: z.coerce.number().int().min(0).max(100),
  certificateMinScore: z.coerce.number().int().min(0).max(100),
});

async function saveCourse(id: number | null, formData: FormData): Promise<FormState | number> {
  await requireRole("admin");
  const parsed = courseSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const slug = slugify(parsed.data.slug || parsed.data.title);
  if (!slug) return { error: "Add a title with letters or numbers." };
  const db = await getDb();
  const clash = await db.select({ id: courses.id }).from(courses).where(id ? and(eq(courses.slug, slug), ne(courses.id, id)) : eq(courses.slug, slug));
  if (clash.length) return { error: `Another course already uses the address "/courses/${slug}".` };
  const [existing] = id ? await db.select().from(courses).where(eq(courses.id, id)) : [];
  const image = await imageField(formData, "image", "removeImage", existing?.imageUrl ?? null, "courses");
  if ("error" in image) return image;
  let curriculumUrl: string | null;
  try {
    curriculumUrl = await resolveFileField(formData, { file: "curriculumFile", remove: "removeCurriculum", current: existing?.curriculumUrl ?? null, folder: "courses", kind: "document" });
  } catch (error) {
    const message = uploadErrorMessage(error);
    if (message) return { error: message };
    throw error;
  }

  const values = {
    ...parsed.data,
    slug,
    durationWeeks: parsed.data.durationWeeks ? Number(parsed.data.durationWeeks) : null,
    outcomes: parseList(formData.get("outcomes"), /\n/).slice(0, 20),
    curriculum: parseList(formData.get("curriculum"), /\n/).slice(0, 40).map((line) => { const [title, ...rest] = line.split("|"); return { title: title.trim(), summary: rest.join("|").trim() }; }).filter((item) => item.title),
    portfolioProjects: parseList(formData.get("portfolioProjects"), /\n/).slice(0, 12),
    jobRoles: parseList(formData.get("jobRoles"), /\n/).slice(0, 20),
    certificateEnabled: formData.get("certificateEnabled") === "on",
    published: formData.get("published") === "on",
    featured: formData.get("featured") === "on",
    imageUrl: image.url,
    curriculumUrl,
    updatedAt: new Date(),
  };
  revalidatePath("/", "layout");
  if (id) {
    await db.update(courses).set(values).where(eq(courses.id, id));
    await deleteIfReplaced(existing?.imageUrl, image.url);
    await deleteIfReplaced(existing?.curriculumUrl, curriculumUrl);
    return id;
  }
  const [row] = await db.insert(courses).values(values).returning({ id: courses.id });
  return row.id;
}

export async function createCourse(_state: FormState, formData: FormData): Promise<FormState> {
  const result = await saveCourse(null, formData);
  if (typeof result !== "number") return result;
  redirect(`/admin/courses/${result}?created=1`);
}

export async function updateCourse(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const result = await saveCourse(id, formData);
  return typeof result === "number" ? { ok: "Course saved." } : result;
}

export async function deleteCourse(id: number): Promise<void> {
  await requireRole("admin");
  const [removed] = await (await getDb()).delete(courses).where(eq(courses.id, id)).returning({ imageUrl: courses.imageUrl, curriculumUrl: courses.curriculumUrl });
  await Promise.all([deleteUpload(removed?.imageUrl), deleteUpload(removed?.curriculumUrl)]);
  revalidatePath("/", "layout");
  redirect("/admin/courses");
}

// ---------- Cohorts ----------

const cohortSchema = z
  .object({
    name: required("Name", 120),
    startDate: dateValue,
    endDate: dateValue,
    deliveryMode: z.enum(DELIVERY_MODES),
    venue: text(300),
    schedule: text(200),
    capacity: z.string().trim().refine((v) => v === "" || /^\d{1,5}$/.test(v), "Capacity must be a whole number."),
    depositPercent: z.string().trim().refine((v) => v === "" || (/^\d{1,2}$/.test(v) && Number(v) >= 10 && Number(v) <= 90), "Deposit must be between 10% and 90%."),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, "The end date must be on or after the start date.")
  .refine((v) => v.deliveryMode === "virtual" || v.venue.length > 0, "Add a venue for in-person or hybrid cohorts.");

function parsePrices(formData: FormData, prefix = "price", label = "price"): { prices: PriceMap } | { error: string } {
  const prices: PriceMap = {};
  for (const code of CURRENCY_CODES) {
    const raw = String(formData.get(`${prefix}-${code}`) ?? "");
    const minor = parseMajor(raw);
    if (minor === null) continue;
    if (Number.isNaN(minor)) return { error: `Enter the ${code} ${label} as a number, e.g. 499 or 499.99.` };
    if (minor > 0) prices[code] = minor;
  }
  return { prices };
}

async function setInstructors(cohortId: number, formData: FormData) {
  const db = await getDb();
  const ids = formData.getAll("instructorIds").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  await db.delete(cohortInstructors).where(eq(cohortInstructors.cohortId, cohortId));
  if (ids.length) await db.insert(cohortInstructors).values(ids.map((userId) => ({ cohortId, userId }))).onConflictDoNothing();
}

async function saveCohort(id: number | null, courseId: number, formData: FormData): Promise<FormState | number> {
  await requireRole("admin");
  const parsed = cohortSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const priced = parsePrices(formData);
  if ("error" in priced) return priced;
  const fees = parsePrices(formData, "regfee", "registration fee");
  if ("error" in fees) return fees;
  const values = {
    ...parsed.data,
    startDate: parsed.data.startDate || null,
    endDate: parsed.data.endDate || null,
    capacity: parsed.data.capacity ? Number(parsed.data.capacity) : null,
    depositPercent: parsed.data.depositPercent ? Number(parsed.data.depositPercent) : null,
    prices: priced.prices,
    registrationFees: fees.prices,
    registrationOnly: formData.get("registrationOnly") === "on",
    enrollmentOpen: formData.get("enrollmentOpen") === "on",
  };
  const db = await getDb();
  let cohortId = id;
  if (id) {
    await db.update(cohorts).set(values).where(eq(cohorts.id, id));
  } else {
    [{ id: cohortId }] = await db.insert(cohorts).values({ ...values, courseId }).returning({ id: cohorts.id }) as [{ id: number }];
  }
  await setInstructors(cohortId!, formData);
  revalidatePath("/", "layout");
  return cohortId!;
}

export async function createCohort(courseId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const result = await saveCohort(null, courseId, formData);
  if (typeof result !== "number") return result;
  redirect(`/admin/cohorts/${result}?created=1`);
}

export async function updateCohort(id: number, courseId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const result = await saveCohort(id, courseId, formData);
  return typeof result === "number" ? { ok: "Cohort saved." } : result;
}

export async function deleteCohort(id: number): Promise<void> {
  await requireRole("admin");
  const [removed] = await (await getDb()).delete(cohorts).where(eq(cohorts.id, id)).returning({ courseId: cohorts.courseId });
  revalidatePath("/", "layout");
  redirect(removed ? `/admin/courses/${removed.courseId}` : "/admin/courses");
}

/** Creates an account (or finds an existing one) and sends a set-password invitation for new accounts. */
async function findOrInvite(name: string, email: string, role: Role): Promise<{ id: number; created: boolean }> {
  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return { id: existing.id, created: false };
  const [user] = await db.insert(users).values({ name, email, role, passwordHash: null }).returning();
  const token = await issueToken(user.id, "invite");
  await sendEmail(email, "invite", { name: firstName(name), role, inviteUrl: absoluteUrl(`/reset-password?token=${token}`) });
  return { id: user.id, created: true };
}

export async function addStudentToCohort(cohortId: number, _state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  if (!parsedEmail.success) return { error: "Enter a valid email address." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 120) || parsedEmail.data.split("@")[0];
  const { id, created } = await findOrInvite(name, parsedEmail.data, "student");
  const added = await activateEnrollment(id, cohortId, "manual");
  revalidatePath(`/admin/cohorts/${cohortId}`);
  if (!added) return { error: "That student is already enrolled on this cohort." };
  return { ok: created ? "Student account created, invitation and enrolment emails sent." : "Student enrolled and emailed." };
}

export async function setEnrollmentStatus(enrollmentId: number, status: "active" | "cancelled" | "completed"): Promise<void> {
  const admin = await requireRole("admin");
  const db = await getDb();
  const [row] = await db.update(enrollments).set({ status }).where(eq(enrollments.id, enrollmentId)).returning({ cohortId: enrollments.cohortId, userId: enrollments.userId });
  if (!row) return;
  if (status === "completed") {
    const eligibility = await certificateEligibility(enrollmentId);
    if (eligibility?.eligible) {
      const code = `TSU-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
      const [certificate] = await db.insert(certificates).values({ enrollmentId, code, issuedById: admin.id }).onConflictDoUpdate({ target: certificates.enrollmentId, set: { revokedAt: null, issuedAt: new Date(), issuedById: admin.id } }).returning();
      const [student] = await db.select().from(users).where(eq(users.id, row.userId));
      const found = await getCohortWithCourse(row.cohortId);
      if (student && found) await sendEmail(student.email, "certificate_issued", { name: firstName(student.name), courseTitle: found.course.title, certificateCode: certificate.code, certificateUrl: absoluteUrl(`/certificates/${certificate.code}`) });
    }
  } else if (status === "cancelled") {
    await db.update(certificates).set({ revokedAt: new Date() }).where(eq(certificates.enrollmentId, enrollmentId));
  }
  revalidatePath(`/admin/cohorts/${row.cohortId}`);
  revalidatePath(`/admin/users/${row.userId}`);
  revalidatePath("/dashboard", "layout");
}

export async function issueCertificate(enrollmentId: number): Promise<void> {
  await setEnrollmentStatus(enrollmentId, "completed");
}

// ---------- People ----------

const inviteSchema = z.object({ name: required("Name", 120), email: emailSchema, role: z.enum(ROLES) });

export async function inviteUser(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = inviteSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { id, created } = await findOrInvite(parsed.data.name, parsed.data.email, parsed.data.role);
  if (!created) return { error: "Someone with that email already has an account. Open their profile to change their role." };
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}?invited=1`);
}

const userSchema = z.object({ name: required("Name", 120), role: z.enum(ROLES), phone: text(40), bio: text(600) });

export async function updateUser(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const parsed = userSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const active = formData.get("active") === "on";
  if (id === admin.id && (parsed.data.role !== "admin" || !active)) return { error: "You can't remove your own admin access or deactivate yourself." };
  const db = await getDb();
  const [before] = await db.select().from(users).where(eq(users.id, id));
  if (!before) return { error: "This account no longer exists." };
  await db.update(users).set({
    ...parsed.data,
    active,
    // Deactivating signs the person out everywhere.
    ...(before.active && !active ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}),
  }).where(eq(users.id, id));
  revalidatePath(`/admin/users/${id}`);
  return { ok: "Saved." };
}

export async function resendInvite(id: number): Promise<void> {
  await requireRole("admin");
  const [user] = await (await getDb()).select().from(users).where(eq(users.id, id));
  if (!user) return;
  const token = await issueToken(user.id, user.passwordHash ? "reset" : "invite");
  if (user.passwordHash) {
    await sendEmail(user.email, "password_reset", { name: firstName(user.name), resetUrl: absoluteUrl(`/reset-password?token=${token}`) });
  } else {
    await sendEmail(user.email, "invite", { name: firstName(user.name), role: user.role, inviteUrl: absoluteUrl(`/reset-password?token=${token}`) });
  }
}

// ---------- Payments ----------

const discountSchema = z.object({
  code: required("Code", 30),
  percentOff: z.coerce.number().int().min(1).max(100),
  maxUses: z.string().trim().refine((value) => value === "" || /^\d+$/.test(value), "Maximum uses must be a whole number."),
  expiresAt: z.string().trim(),
});

export async function createDiscountCode(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = discountSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const code = parsed.data.code.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(code)) return { error: "Use letters, numbers, hyphens or underscores only." };
  try {
    await (await getDb()).insert(discountCodes).values({ code, percentOff: parsed.data.percentOff, maxUses: parsed.data.maxUses ? Number(parsed.data.maxUses) : null, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null });
  } catch {
    return { error: "That discount code already exists." };
  }
  revalidatePath("/admin/discounts");
  return { ok: `${code} is ready to use.` };
}

export async function setDiscountCodeActive(id: number, active: boolean): Promise<void> {
  await requireRole("admin");
  await (await getDb()).update(discountCodes).set({ active }).where(eq(discountCodes.id, id));
  revalidatePath("/admin/discounts");
}

export async function sendBalanceReminder(userId: number, cohortId: number, currency: string): Promise<void> {
  await requireRole("admin");
  const db = await getDb();
  const [[student], found] = await Promise.all([db.select().from(users).where(eq(users.id, userId)), getCohortWithCourse(cohortId)]);
  if (!student || !found) return;
  const balance = await paymentBalanceFor(userId, found.cohort, currency);
  if (!balance.remaining) return;
  await notify([userId], {
    kind: "payment",
    title: `Payment balance due: ${formatMoney(balance.remaining, currency)}`,
    body: `${found.course.title} · ${found.cohort.name}`,
    href: "/dashboard/payments",
    email: {
      template: "balance_reminder",
      isReminder: true,
      vars: { courseTitle: found.course.title, cohortName: found.cohort.name, amount: formatMoney(balance.remaining, currency), paid: formatMoney(balance.paid, currency), paymentsUrl: absoluteUrl("/dashboard/payments") },
    },
  });
  revalidatePath("/admin/payments");
}

export async function markPaymentPaid(reference: string): Promise<void> {
  await requireRole("admin");
  await fulfilPayment(reference);
  revalidatePath("/admin/payments");
}

/** Re-asks Stripe/Paystack about a pending payment (useful if a webhook was missed). */
export async function recheckPayment(reference: string): Promise<void> {
  await requireRole("admin");
  await verifyPayment(reference);
  revalidatePath("/admin/payments");
}

export async function markPaymentFailed(reference: string): Promise<void> {
  await requireRole("admin");
  await (await getDb()).update(payments).set({ status: "failed" }).where(and(eq(payments.reference, reference), eq(payments.status, "pending")));
  revalidatePath("/admin/payments");
}

export async function recordOfflinePayment(_state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  if (!parsedEmail.success) return { error: "Enter the student's email address." };
  const cohortId = Number(formData.get("cohortId"));
  const found = Number.isInteger(cohortId) ? await getCohortWithCourse(cohortId) : null;
  if (!found) return { error: "Choose a cohort." };
  const currency = String(formData.get("currency") ?? "");
  if (!CURRENCY_CODES.includes(currency)) return { error: "Choose a currency." };
  const amount = parseMajor(String(formData.get("amount") ?? ""));
  if (!amount || Number.isNaN(amount)) return { error: "Enter the amount received." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 120) || parsedEmail.data.split("@")[0];

  const { id: userId } = await findOrInvite(name, parsedEmail.data, "student");
  const reference = `OFF-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  await (await getDb()).insert(payments).values({
    reference, userId, cohortId, gateway: "manual", amount, currency, status: "pending",
    description: `${describePurchase(found.course, found.cohort)}${note ? ` (${note})` : ""}`,
  });
  await fulfilPayment(reference);
  revalidatePath("/admin/payments");
  return { ok: `Payment recorded (${reference}). The student is enrolled and has been emailed a receipt.` };
}

// ---------- Email templates ----------

export async function saveTemplate(key: string, _state: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  if (!isTemplateKey(key)) return { error: "Unknown template." };
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 20_000);
  if (!subject || !body) return { error: "The subject and body are both required." };
  const db = await getDb();
  await db.insert(emailTemplates).values({ key, subject, body }).onConflictDoUpdate({ target: emailTemplates.key, set: { subject, body, updatedAt: new Date() } });
  revalidatePath("/admin/settings");
  revalidatePath(`/admin/emails/${key}`);
  return { ok: "Template saved. The preview below shows the new version." };
}

export async function setTemplateEnabled(key: string, enabled: boolean): Promise<void> {
  await requireRole("admin");
  if (!isTemplateKey(key) || REQUIRED_TEMPLATES.includes(key)) return;
  const def = EMAIL_TEMPLATES[key];
  await (await getDb()).insert(emailTemplates).values({ key, subject: def.subject, body: def.body, enabled }).onConflictDoUpdate({ target: emailTemplates.key, set: { enabled, updatedAt: new Date() } });
  revalidatePath("/admin/settings");
}

export async function resetTemplate(key: string): Promise<void> {
  await requireRole("admin");
  if (!isTemplateKey(key)) return;
  const def = EMAIL_TEMPLATES[key];
  // Keep the on/off choice; only the wording goes back to the original.
  await (await getDb()).update(emailTemplates).set({ subject: def.subject, body: def.body, updatedAt: new Date() }).where(eq(emailTemplates.key, key));
  revalidatePath(`/admin/emails/${key}`);
  redirect(`/admin/emails/${key}?reset=1`);
}

export async function sendTestEmail(key: string): Promise<void> {
  const admin = await requireRole("admin");
  if (!isTemplateKey(key)) return;
  await sendEmail(admin.email, key, { ...COMMON_VARIABLES, ...EMAIL_TEMPLATES[key].variables, name: firstName(admin.name) });
}
