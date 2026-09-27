"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isFree } from "@/lib/catalog";
import { getCohortWithCourse, isEnrolled, seatsTaken } from "@/lib/data";
import { activateEnrollment, startBalanceCheckout, startBankTransfer, startCheckout } from "@/lib/payments";
import type { FormState } from "@/lib/validation";

/** Enrols the signed-in user on a cohort: free cohorts immediately, paid ones via checkout. */
export async function enroll(cohortId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const found = await getCohortWithCourse(cohortId);
  if (!found || !found.course.published) return { error: "This cohort is no longer available." };
  const { cohort, course } = found;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/courses/${course.slug}#cohort-${cohort.id}`)}`);

  if (await isEnrolled(user.id, cohort.id)) redirect(`/dashboard/cohorts/${cohort.id}`);
  if (!cohort.enrollmentOpen) return { error: "Enrolment for this cohort has closed." };
  if (cohort.capacity) {
    const taken = (await seatsTaken([cohort.id])).get(cohort.id) ?? 0;
    if (taken >= cohort.capacity) return { error: "Sorry, this cohort is full." };
  }

  if (isFree(cohort)) {
    await activateEnrollment(user.id, cohort.id, "free");
    redirect(`/dashboard/cohorts/${cohort.id}?welcome=1`);
  }

  const result = formData.get("method") === "bank"
    ? await startBankTransfer(user, course, cohort)
    : await startCheckout(user, course, cohort, String(formData.get("currency") ?? ""), {
      plan: formData.get("paymentPlan") === "deposit" ? "deposit" : "full",
      discountCode: String(formData.get("discountCode") ?? ""),
    });
  if ("error" in result) return { error: result.error };
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
