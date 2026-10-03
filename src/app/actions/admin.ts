"use server";

import { randomBytes } from "node:crypto";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  certificates, cohortInstructors, cohorts, courses, DELIVERY_MODES, discountCodes, emailTemplates, enrollments, internshipCourses, payments, ROLES, users,
  type PriceMap, type Role,
} from "@/db/schema";
import { can, requirePermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { offerOpenPlaces } from "@/lib/waitlist";
import { getCohortWithCourse, getSettings } from "@/lib/data";
import { fromZonedInput } from "@/lib/time";
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
  certificateMinQuizScore: z.coerce.number().int().min(0).max(100),
  seoTitle: text(70),
  seoDescription: text(200),
});

async function saveCourse(id: number | null, formData: FormData): Promise<FormState | number> {
  const actor = await requirePermission("courses.manage");
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
  const hero = await imageField(formData, "heroImage", "removeHeroImage", existing?.heroImageUrl ?? null, "courses");
  if ("error" in hero) return hero;
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
    kind: formData.get("kind") === "internship" ? "internship" as const : "course" as const,
    published: formData.get("published") === "on",
    featured: formData.get("featured") === "on",
    imageUrl: image.url,
    heroImageUrl: hero.url,
    curriculumUrl,
    updatedAt: new Date(),
  };
  revalidatePath("/", "layout");
  let savedId = id;
  if (id) {
    await db.update(courses).set(values).where(eq(courses.id, id));
    await deleteIfReplaced(existing?.imageUrl, image.url);
    await deleteIfReplaced(existing?.heroImageUrl, hero.url);
    await deleteIfReplaced(existing?.curriculumUrl, curriculumUrl);
  } else {
    [{ id: savedId }] = await db.insert(courses).values(values).returning({ id: courses.id }) as [{ id: number }];
  }
  if (values.kind === "internship") await setLinkedCourses(savedId!, formData);
  await logAudit(actor, { action: id ? "course.updated" : "course.created", summary: `${id ? "updated" : "created"} the ${values.kind === "internship" ? "internship" : "course"} “${values.title}”`, target: { type: "course", id: savedId! } });
  return savedId!;
}

/** Saves which courses' graduates join an internship free (only real courses, not other internships). */
async function setLinkedCourses(internshipId: number, formData: FormData) {
  const db = await getDb();
  const wanted = formData.getAll("linkedCourseIds").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const valid = wanted.length ? (await db.select({ id: courses.id }).from(courses).where(and(inArray(courses.id, wanted), eq(courses.kind, "course")))).map((c) => c.id) : [];
  await db.delete(internshipCourses).where(eq(internshipCourses.internshipId, internshipId));
  if (valid.length) await db.insert(internshipCourses).values(valid.map((courseId) => ({ internshipId, courseId })));
}

export async function createCourse(_state: FormState, formData: FormData): Promise<FormState> {
  const result = await saveCourse(null, formData);
  if (typeof result !== "number") return result;
  redirect(formData.get("kind") === "internship" ? `/admin/internships/${result}?created=1` : `/admin/courses/${result}?created=1`);
}

export async function updateCourse(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const result = await saveCourse(id, formData);
  return typeof result === "number" ? { ok: formData.get("kind") === "internship" ? "Internship saved." : "Course saved." } : result;
}

export async function deleteCourse(id: number): Promise<void> {
  const actor = await requirePermission("courses.manage");
  const [removed] = await (await getDb()).delete(courses).where(eq(courses.id, id)).returning({ title: courses.title, kind: courses.kind, imageUrl: courses.imageUrl, heroImageUrl: courses.heroImageUrl, curriculumUrl: courses.curriculumUrl });
  await Promise.all([deleteUpload(removed?.imageUrl), deleteUpload(removed?.heroImageUrl), deleteUpload(removed?.curriculumUrl)]);
  if (removed) await logAudit(actor, { action: "course.deleted", summary: `deleted the ${removed.kind === "internship" ? "internship" : "course"} “${removed.title}” and its cohorts`, target: { type: "course", id } });
  revalidatePath("/", "layout");
  redirect(removed?.kind === "internship" ? "/admin/internships" : "/admin/courses");
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
  const actor = await requirePermission("courses.manage");
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
    graduatesFree: formData.get("graduatesFree") === "on",
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
  // More seats (or enrolment reopened) can mean places for people on the waitlist.
  if (id) await offerOpenPlaces(cohortId!);
  await logAudit(actor, { action: id ? "cohort.updated" : "cohort.created", summary: `${id ? "updated" : "created"} the cohort “${values.name}”`, target: { type: "cohort", id: cohortId! }, details: { prices: values.prices } });
  revalidatePath("/", "layout");
  return cohortId!;
}

export async function createCohort(courseId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const result = await saveCohort(null, courseId, formData);
  if (typeof result !== "number") return result;
  redirect(`/teach/cohorts/${result}?created=1`);
}

export async function updateCohort(id: number, courseId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const result = await saveCohort(id, courseId, formData);
  return typeof result === "number" ? { ok: "Cohort saved." } : result;
}

export async function deleteCohort(id: number): Promise<void> {
  const actor = await requirePermission("courses.manage");
  const [removed] = await (await getDb()).delete(cohorts).where(eq(cohorts.id, id)).returning({ courseId: cohorts.courseId, name: cohorts.name });
  if (removed) await logAudit(actor, { action: "cohort.deleted", summary: `deleted the cohort “${removed.name}”`, target: { type: "cohort", id } });
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
  const actor = await requirePermission("users.manage");
  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  if (!parsedEmail.success) return { error: "Enter a valid email address." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 120) || parsedEmail.data.split("@")[0];
  const { id, created } = await findOrInvite(name, parsedEmail.data, "student");
  const added = await activateEnrollment(id, cohortId, "manual");
  revalidatePath(`/teach/cohorts/${cohortId}`);
  if (!added) return { error: "That student is already enrolled on this cohort." };
  await logAudit(actor, { action: "enrolment.added", summary: `enrolled ${name} (${parsedEmail.data}) without payment`, target: { type: "cohort", id: cohortId } });
  return { ok: created ? "Student account created, invitation and enrolment emails sent." : "Student enrolled and emailed." };
}

export async function setEnrollmentStatus(enrollmentId: number, status: "active" | "cancelled" | "completed"): Promise<void> {
  const admin = await requirePermission("users.manage");
  const db = await getDb();
  const [row] = await db.update(enrollments).set({ status, completedAt: status === "completed" ? new Date() : null }).where(eq(enrollments.id, enrollmentId)).returning({ cohortId: enrollments.cohortId, userId: enrollments.userId });
  if (!row) return;
  const [person] = await db.select({ name: users.name }).from(users).where(eq(users.id, row.userId));
  await logAudit(admin, { action: `enrolment.${status}`, summary: `${status === "completed" ? "marked complete" : status === "cancelled" ? "removed" : "reactivated"} ${person?.name ?? "a student"}'s enrolment`, target: { type: "cohort", id: row.cohortId } });
  if (status === "completed") {
    const eligibility = await certificateEligibility(enrollmentId);
    if (eligibility?.eligible) {
      const code = `TSU-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`;
      const [certificate] = await db.insert(certificates).values({ enrollmentId, code, issuedById: admin.id }).onConflictDoUpdate({ target: certificates.enrollmentId, set: { revokedAt: null, issuedAt: new Date(), issuedById: admin.id } }).returning();
      await logAudit(admin, { action: "certificate.issued", summary: `issued certificate ${certificate.code} to ${person?.name ?? "a student"}`, target: { type: "certificate", id: certificate.code } });
      const [student] = await db.select().from(users).where(eq(users.id, row.userId));
      const found = await getCohortWithCourse(row.cohortId);
      if (student && found) await sendEmail(student.email, "certificate_issued", { name: firstName(student.name), courseTitle: found.course.title, certificateCode: certificate.code, certificateUrl: absoluteUrl(`/certificates/${certificate.code}`) });
    }
  } else if (status === "cancelled") {
    await db.update(certificates).set({ revokedAt: new Date() }).where(eq(certificates.enrollmentId, enrollmentId));
    // A place has opened: offer it to the waitlist.
    await offerOpenPlaces(row.cohortId);
  }
  revalidatePath(`/teach/cohorts/${row.cohortId}`);
  revalidatePath(`/admin/users/${row.userId}`);
  revalidatePath("/dashboard", "layout");
}

export async function issueCertificate(enrollmentId: number): Promise<void> {
  await setEnrollmentStatus(enrollmentId, "completed");
}

// ---------- People ----------

const inviteSchema = z.object({ name: required("Name", 120), email: emailSchema, role: z.enum(ROLES) });

export async function inviteUser(_state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("users.manage");
  const parsed = inviteSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  // Staff accounts need a role, so they're invited from Team & roles.
  if (parsed.data.role === "staff") return { error: "Invite team members from Team & roles, where you choose what they can do." };
  if (parsed.data.role === "admin" && !(await can(actor, "team.manage"))) return { error: "Only people who manage the team can invite administrators." };
  const { id, created } = await findOrInvite(parsed.data.name, parsed.data.email, parsed.data.role);
  if (!created) return { error: "Someone with that email already has an account. Open their profile to change their role." };
  await logAudit(actor, { action: "user.invited", summary: `invited ${parsed.data.name} (${parsed.data.email}) as ${parsed.data.role}`, target: { type: "user", id } });
  revalidatePath("/admin/users");
  redirect(`/admin/users/${id}?invited=1`);
}

const userSchema = z.object({ name: required("Name", 120), role: z.enum(ROLES), phone: text(40), bio: text(600), gender: z.enum(["female", "male", ""]).catch("").transform((g) => g || null) });

export async function updateUser(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission("users.manage");
  const parsed = userSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const active = formData.get("active") === "on";
  if (id === admin.id && (parsed.data.role !== admin.role || !active)) return { error: "You can't change your own role or deactivate yourself." };
  const db = await getDb();
  const [before] = await db.select().from(users).where(eq(users.id, id));
  if (!before) return { error: "This account no longer exists." };
  // Anything touching admin or team access is for people who manage the team.
  const staffy = (role: string) => role === "admin" || role === "staff";
  if ((staffy(before.role) || staffy(parsed.data.role)) && (parsed.data.role !== before.role || !active) && !(await can(admin, "team.manage"))) {
    return { error: "Only people who manage the team can change administrator or team access." };
  }
  if (parsed.data.role === "staff" && before.role !== "staff") return { error: "Give someone a team role from Team & roles, where you choose what they can do." };
  if (before.role === "admin" && (parsed.data.role !== "admin" || !active) && (await activeAdminCount()) <= 1) return { error: "They're the only active administrator. Make someone else an administrator first." };
  await db.update(users).set({
    ...parsed.data,
    active,
    // Deactivating signs the person out everywhere.
    // Staff roles only apply to team members.
    ...(parsed.data.role !== "staff" ? { staffRoleKey: null } : {}),
    ...(before.active && !active ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}),
  }).where(eq(users.id, id));
  if (parsed.data.role !== before.role) await logAudit(admin, { action: "user.role_changed", summary: `changed ${before.name}'s role from ${before.role} to ${parsed.data.role}`, target: { type: "user", id } });
  if (before.active !== active) await logAudit(admin, { action: active ? "user.reactivated" : "user.deactivated", summary: `${active ? "reactivated" : "deactivated"} ${before.name}'s account`, target: { type: "user", id } });
  revalidatePath(`/admin/users/${id}`);
  return { ok: "Saved." };
}

/** Active administrators, so the last one can't be removed. */
async function activeAdminCount(): Promise<number> {
  const [row] = await (await getDb()).select({ n: count() }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true)));
  return row?.n ?? 0;
}

export async function resendInvite(id: number): Promise<void> {
  await requirePermission("users.manage");
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
  const actor = await requirePermission("discounts.manage");
  const parsed = discountSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const code = parsed.data.code.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(code)) return { error: "Use letters, numbers, hyphens or underscores only." };
  try {
    const { timezone } = await getSettings();
    await (await getDb()).insert(discountCodes).values({ code, percentOff: parsed.data.percentOff, maxUses: parsed.data.maxUses ? Number(parsed.data.maxUses) : null, expiresAt: parsed.data.expiresAt ? fromZonedInput(parsed.data.expiresAt, timezone) : null });
  } catch {
    return { error: "That discount code already exists." };
  }
  await logAudit(actor, { action: "discount.created", summary: `created the discount code ${code} (${parsed.data.percentOff}% off)` });
  revalidatePath("/admin/discounts");
  return { ok: `${code} is ready to use.` };
}

export async function setDiscountCodeActive(id: number, active: boolean): Promise<void> {
  const actor = await requirePermission("discounts.manage");
  const [row] = await (await getDb()).update(discountCodes).set({ active }).where(eq(discountCodes.id, id)).returning({ code: discountCodes.code });
  if (row) await logAudit(actor, { action: active ? "discount.enabled" : "discount.disabled", summary: `${active ? "switched on" : "switched off"} the discount code ${row.code}` });
  revalidatePath("/admin/discounts");
}

/** Changes a code's discount, usage limit or expiry. The code itself stays the same. */
export async function updateDiscountCode(id: number, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("discounts.manage");
  const parsed = discountSchema.omit({ code: true }).safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  const [before] = await db.select().from(discountCodes).where(eq(discountCodes.id, id));
  if (!before || before.deletedAt) return { error: "This code no longer exists." };
  const maxUses = parsed.data.maxUses ? Number(parsed.data.maxUses) : null;
  if (maxUses !== null && maxUses < before.usedCount) return { error: `It has already been used ${before.usedCount} time${before.usedCount === 1 ? "" : "s"}, so the limit can't be lower than that.` };
  const { timezone } = await getSettings();
  const expiresAt = parsed.data.expiresAt ? fromZonedInput(parsed.data.expiresAt, timezone) : null;
  await db.update(discountCodes).set({ percentOff: parsed.data.percentOff, maxUses, expiresAt }).where(eq(discountCodes.id, id));
  const changes = [
    before.percentOff !== parsed.data.percentOff && `discount ${before.percentOff}% → ${parsed.data.percentOff}%`,
    before.maxUses !== maxUses && `max uses ${before.maxUses ?? "unlimited"} → ${maxUses ?? "unlimited"}`,
    (before.expiresAt?.getTime() ?? null) !== (expiresAt?.getTime() ?? null) && `expiry ${expiresAt ? "changed" : "removed"}`,
  ].filter(Boolean);
  if (changes.length) await logAudit(actor, { action: "discount.updated", summary: `edited the discount code ${before.code} (${changes.join(", ")})` });
  revalidatePath("/admin/discounts");
  return { ok: `${before.code} saved.` };
}

/**
 * Deletes a discount code. Codes nobody has used go completely; used ones are switched off, hidden and renamed
 * (so the name can be reused) but kept, because balances on deposits paid with them depend on the discount.
 */
export async function deleteDiscountCode(id: number): Promise<void> {
  const actor = await requirePermission("discounts.manage");
  const db = await getDb();
  const [code] = await db.select().from(discountCodes).where(eq(discountCodes.id, id));
  if (!code || code.deletedAt) return;
  const [used] = await db.select({ id: payments.id }).from(payments).where(eq(payments.discountCodeId, id)).limit(1);
  if (used || code.usedCount > 0) {
    await db.update(discountCodes).set({ active: false, deletedAt: new Date(), code: `${code.code}~deleted-${id}` }).where(eq(discountCodes.id, id));
  } else {
    await db.delete(discountCodes).where(eq(discountCodes.id, id));
  }
  await logAudit(actor, { action: "discount.deleted", summary: `deleted the discount code ${code.code}` });
  revalidatePath("/admin/discounts");
}

export async function sendBalanceReminder(userId: number, cohortId: number, currency: string): Promise<void> {
  await requirePermission("payments.manage");
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
  const actor = await requirePermission("payments.manage");
  await fulfilPayment(reference);
  await logAudit(actor, { action: "payment.confirmed", summary: `confirmed payment ${reference} as received`, target: { type: "payment", id: reference } });
  revalidatePath("/admin/payments");
}

/** Re-asks Stripe/Paystack/TransactPay about a pending payment (useful if a webhook was missed). */
export async function recheckPayment(reference: string): Promise<void> {
  await requirePermission("payments.manage");
  await verifyPayment(reference);
  revalidatePath("/admin/payments");
}

export async function markPaymentFailed(reference: string): Promise<void> {
  const actor = await requirePermission("payments.manage");
  await logAudit(actor, { action: "payment.failed", summary: `marked payment ${reference} as not received`, target: { type: "payment", id: reference } });
  await (await getDb()).update(payments).set({ status: "failed" }).where(and(eq(payments.reference, reference), eq(payments.status, "pending")));
  revalidatePath("/admin/payments");
}

export async function recordOfflinePayment(_state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("payments.manage");
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
  await logAudit(actor, { action: "payment.recorded", summary: `recorded an offline payment of ${formatMoney(amount, currency)} from ${name} (${reference})`, target: { type: "payment", id: reference } });
  revalidatePath("/admin/payments");
  return { ok: `Payment recorded (${reference}). The student is enrolled and has been emailed a receipt.` };
}

/**
 * Records a refund that has been sent back to the student (from Stripe, Paystack, TransactPay or the bank).
 * The academy's figures then show the net amount; a full refund marks the payment refunded.
 */
export async function recordRefund(reference: string, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("payments.manage");
  const db = await getDb();
  const [payment] = await db.select().from(payments).where(eq(payments.reference, reference));
  if (!payment || payment.status !== "paid") return { error: "Only successful payments can be refunded." };
  const refundable = payment.amount - payment.refundedAmount;
  const amount = parseMajor(String(formData.get("amount") ?? ""));
  if (!amount || amount <= 0) return { error: "Enter the amount refunded." };
  if (amount > refundable) return { error: `You can refund at most ${formatMoney(refundable, payment.currency)} on this payment.` };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (reason.length < 3) return { error: "Add a short reason, for your records." };
  const total = payment.refundedAmount + amount;
  const full = total >= payment.amount;
  await db.update(payments).set({ refundedAmount: total, refundedAt: new Date(), refundReason: reason, refundedById: actor.id, ...(full ? { status: "refunded" as const } : {}) }).where(eq(payments.id, payment.id));

  // Optionally take them off the cohort (and withdraw any certificate) at the same time.
  let removed = false;
  if (formData.get("removeFromCohort") === "on" && payment.cohortId) {
    const [row] = await db.update(enrollments).set({ status: "cancelled", completedAt: null }).where(and(eq(enrollments.userId, payment.userId), eq(enrollments.cohortId, payment.cohortId))).returning({ id: enrollments.id });
    if (row) {
      await db.update(certificates).set({ revokedAt: new Date() }).where(eq(certificates.enrollmentId, row.id));
      removed = true;
      await offerOpenPlaces(payment.cohortId);
    }
  }
  const [student] = await db.select().from(users).where(eq(users.id, payment.userId));
  if (student && formData.get("notify") === "on") {
    await sendEmail(student.email, "refund_processed", { name: firstName(student.name), amount: formatMoney(amount, payment.currency), description: payment.description, reference: payment.reference, paymentsUrl: absoluteUrl("/dashboard/payments") });
  }
  await logAudit(actor, { action: "refund.recorded", summary: `recorded a ${full ? "full" : "partial"} refund of ${formatMoney(amount, payment.currency)} on ${reference}${student ? ` for ${student.name}` : ""}${removed ? " and removed them from the cohort" : ""}`, target: { type: "payment", id: reference }, details: { reason } });
  revalidatePath("/admin/payments");
  revalidatePath("/dashboard/payments");
  return { ok: `Refund of ${formatMoney(amount, payment.currency)} recorded${removed ? " and the student was removed from the cohort" : ""}.` };
}

// ---------- Email templates ----------

export async function saveTemplate(key: string, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("emails.manage");
  if (isTemplateKey(key)) await logAudit(actor, { action: "email_template.saved", summary: `edited the “${EMAIL_TEMPLATES[key].name}” email`, target: { type: "email_template", id: key } });
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
  await requirePermission("emails.manage");
  if (!isTemplateKey(key) || REQUIRED_TEMPLATES.includes(key)) return;
  const def = EMAIL_TEMPLATES[key];
  await (await getDb()).insert(emailTemplates).values({ key, subject: def.subject, body: def.body, enabled }).onConflictDoUpdate({ target: emailTemplates.key, set: { enabled, updatedAt: new Date() } });
  revalidatePath("/admin/settings");
}

export async function resetTemplate(key: string): Promise<void> {
  await requirePermission("emails.manage");
  if (!isTemplateKey(key)) return;
  const def = EMAIL_TEMPLATES[key];
  // Keep the on/off choice; only the wording goes back to the original.
  await (await getDb()).update(emailTemplates).set({ subject: def.subject, body: def.body, updatedAt: new Date() }).where(eq(emailTemplates.key, key));
  revalidatePath(`/admin/emails/${key}`);
  redirect(`/admin/emails/${key}?reset=1`);
}

export async function sendTestEmail(key: string): Promise<void> {
  const admin = await requirePermission("emails.manage");
  if (!isTemplateKey(key)) return;
  await sendEmail(admin.email, key, { ...COMMON_VARIABLES, ...EMAIL_TEMPLATES[key].variables, name: firstName(admin.name) });
}
