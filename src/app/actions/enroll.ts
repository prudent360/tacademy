"use server";

import { attachReferrer } from "@/lib/referrals";
import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { enrollments, users, type User } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { countryByCode } from "@/lib/countries";
import { isFree } from "@/lib/catalog";
import { rememberCheckout } from "@/lib/checkout-access";
import { getCohortWithCourse, graduateFor, isEnrolled, seatsTaken } from "@/lib/data";
import { activateEnrollment, findDiscount, startBalanceCheckout, startBankTransfer, startCheckout } from "@/lib/payments";
import { availablePlans, type EnrolPlan } from "@/lib/pricing";
import { loginBlockedFor, recordLoginFailure } from "@/lib/rate-limit";
import { QUALIFICATIONS } from "@/lib/utils";
import { dialCode, email, firstError, formatPhone, formValues, phoneNumber, required, type FormState } from "@/lib/validation";

export type EnrolState = { error?: string; signIn?: string } | undefined;

const detailsSchema = z.object({
  firstName: required("First name", 60),
  lastName: required("Last name", 60),
  email,
  dialCode,
  phone: phoneNumber,
  dateOfBirth: z.string().trim().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "1920-01-01" && v <= new Date().toISOString().slice(0, 10), "Enter a valid date of birth."),
  country: z.string().trim().toUpperCase().refine((v) => Boolean(countryByCode(v)), "Choose the country you live in."),
  gender: z.enum(["female", "male", ""]).catch(""),
  qualification: z.string().refine((v) => v === "" || (QUALIFICATIONS as readonly string[]).includes(v), "Choose a qualification from the list."),
  cohortId: z.coerce.number().int().positive("Choose a course and cohort."),
  currency: z.string().trim().max(3),
  plan: z.enum(["full", "deposit", "registration"]).catch("full"),
  method: z.enum(["online", "bank"]).catch("online"),
  discountCode: z.string().trim().max(40).catch(""),
});

type Details = z.infer<typeof detailsSchema>;

/**
 * Finds or creates the student for an enrolment. Only enrolled students get a usable account:
 * new students are created without a password and choose one from the email sent when their place is confirmed.
 */
async function applicantFor(details: Details, next: string): Promise<{ user: User } | { error: string; signIn?: string }> {
  const db = await getDb();
  const profile = { phone: formatPhone(details.dialCode, details.phone), dateOfBirth: details.dateOfBirth, gender: details.gender || null, qualification: details.qualification, country: details.country };
  const signedIn = await getCurrentUser();
  if (signedIn) {
    const [user] = await db.update(users).set(profile).where(eq(users.id, signedIn.id)).returning();
    return { user };
  }

  const name = `${details.firstName} ${details.lastName}`;
  const [existing] = await db.select().from(users).where(eq(users.email, details.email));
  if (existing) {
    const [enrolled] = await db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.userId, existing.id), inArray(enrollments.status, ["active", "completed"])));
    if (existing.passwordHash || enrolled || existing.role !== "student") {
      return { error: "You already have an account with this email. Sign in to enrol, or use “Forgot password” if you haven't set a password yet.", signIn: `/login?next=${encodeURIComponent(next)}` };
    }
    // Someone who started enrolling before but never paid: refresh their details.
    const [user] = await db.update(users).set({ ...profile, name }).where(eq(users.id, existing.id)).returning();
    await attachReferrer(user.id);
    return { user };
  }

  const [user] = await db.insert(users).values({ ...profile, name, email: details.email, role: "student" }).returning();
  await attachReferrer(user.id);
  return { user };
}

/** The enrolment form: saves the student's details, then confirms free places or starts payment. */
export async function enrol(_state: EnrolState, formData: FormData): Promise<EnrolState> {
  const parsed = detailsSchema.safeParse(formValues(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const details = parsed.data;

  const found = await getCohortWithCourse(details.cohortId);
  if (!found || !found.course.published) return { error: "This cohort is no longer available." };
  const { cohort, course } = found;
  if (!cohort.enrollmentOpen) return { error: "Enrolment for this cohort has closed." };
  if (cohort.capacity) {
    const taken = (await seatsTaken([cohort.id])).get(cohort.id) ?? 0;
    if (taken >= cohort.capacity) return { error: "Sorry, this cohort is full." };
  }

  // Slows down automated sign-ups, per email and per network.
  const wait = await loginBlockedFor(details.email, "enrol");
  if (wait) return { error: `Too many attempts. Please try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  await recordLoginFailure(details.email, "enrol");

  const applicant = await applicantFor(details, `/enroll?cohort=${cohort.id}`);
  if ("error" in applicant) return applicant;
  const { user } = applicant;
  if (await isEnrolled(user.id, cohort.id)) return { error: "You're already enrolled on this cohort.", signIn: `/dashboard/cohorts/${cohort.id}` };

  // Graduates of the academy join cohorts marked "free for graduates" without paying; checked here, never trusted from the form.
  const graduateFree = !isFree(cohort) && cohort.graduatesFree && (await graduateFor(user.id, course.id));
  if (isFree(cohort) || graduateFree) {
    await activateEnrollment(user.id, cohort.id, graduateFree ? "graduate" : "free");
    redirect(user.passwordHash ? `/dashboard/cohorts/${cohort.id}?welcome=1` : `/enroll/confirmed?email=${encodeURIComponent(user.email)}`);
  }

  const plan: EnrolPlan = availablePlans(cohort, details.currency).includes(details.plan) ? details.plan : "full";
  const result = details.method === "bank"
    ? await startBankTransfer(user, course, cohort, plan, details.discountCode)
    : await startCheckout(user, course, cohort, details.currency, { plan, discountCode: details.discountCode });
  if ("error" in result) return { error: result.error };
  await rememberCheckout(result.reference);
  redirect(result.url);
}

export async function payBalance(cohortId: number, currency: string, state: FormState): Promise<FormState> {
  void state;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/payments");
  const found = await getCohortWithCourse(cohortId);
  if (!found) return { error: "That cohort is no longer available." };
  if (!(await isEnrolled(user.id, cohortId))) return { error: "You are not enrolled on that cohort." };
  const result = await startBalanceCheckout(user, found.course, found.cohort, currency);
  if ("error" in result) return { error: result.error };
  redirect(result.url);
}

/** Checks a discount code for the enrol form, so the saving shows before paying. Wrong guesses are rate limited. */
export async function checkDiscountCode(code: string): Promise<{ code: string; percentOff: number } | { error: string }> {
  const wait = await loginBlockedFor("discount-code", "discount");
  if (wait) return { error: `Too many codes tried. Please try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  const found = await findDiscount(String(code).slice(0, 40));
  if ("error" in found) {
    await recordLoginFailure("discount-code", "discount");
    return found;
  }
  return { code: found.code, percentOff: found.percentOff };
}
