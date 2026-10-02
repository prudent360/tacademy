"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { courseReviews, courses, type ReviewStatus } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { requirePermission, requireUser } from "@/lib/auth";
import { getAdmins } from "@/lib/data";
import { notify } from "@/lib/notify";
import { reviewableFor } from "@/lib/reviews";
import type { FormState } from "@/lib/validation";

/** A student rates a course they've finished. Editing sends it back for approval. */
export async function submitReview(enrollmentId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const allowed = (await reviewableFor(user.id)).find((r) => r.enrollmentId === enrollmentId);
  if (!allowed) return { error: "You can review a course once you've finished it." };
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose a star rating." };
  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);
  if (body.length < 10) return { error: "Write a sentence or two about your experience." };
  const db = await getDb();
  await db.insert(courseReviews).values({ courseId: allowed.courseId, userId: user.id, enrollmentId, rating, body })
    .onConflictDoUpdate({ target: courseReviews.enrollmentId, set: { rating, body, status: "pending", publishedAt: null, updatedAt: new Date() } });
  await notify((await getAdmins()).map((a) => a.id), { kind: "review", title: `New ${rating}★ review: ${allowed.courseTitle}`, body: `${user.name}: “${body.slice(0, 120)}${body.length > 120 ? "…" : ""}”`, href: "/admin/reviews?status=pending" });
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin/reviews");
  return { ok: "Thank you! Your review will appear on the course page once it's approved." };
}

export async function setReviewStatus(id: number, status: ReviewStatus): Promise<void> {
  const actor = await requirePermission("reviews.manage");
  const db = await getDb();
  const [review] = await db.update(courseReviews).set({ status, moderatedById: actor.id, publishedAt: status === "published" ? new Date() : null, updatedAt: new Date() }).where(eq(courseReviews.id, id)).returning();
  if (!review) return;
  const [course] = await db.select({ title: courses.title, slug: courses.slug }).from(courses).where(and(eq(courses.id, review.courseId)));
  await logAudit(actor, { action: `review.${status}`, summary: `${status === "published" ? "published" : status === "hidden" ? "hid" : "unpublished"} a ${review.rating}★ review of ${course?.title ?? "a course"}`, target: { type: "review", id } });
  revalidatePath("/admin/reviews");
  if (course) revalidatePath(`/courses/${course.slug}`);
  revalidatePath("/courses");
  revalidatePath("/");
}
