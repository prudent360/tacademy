import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { setReviewStatus } from "@/app/actions/reviews";
import { ActionButton } from "@/components/forms";
import { MessageIcon } from "@/components/icons";
import { Star } from "@/components/portal/review-form";
import { Avatar, Badge, Card, EmptyState, PageHeader, TableToolbar } from "@/components/ui";
import { getDb } from "@/db";
import { cohorts, courseReviews, courses, enrollments, REVIEW_STATUSES, users, type ReviewStatus } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Reviews" };

const LABEL: Record<ReviewStatus, string> = { pending: "Awaiting approval", published: "Published", hidden: "Hidden" };
const TONE: Record<ReviewStatus, "amber" | "green" | "neutral"> = { pending: "amber", published: "green", hidden: "neutral" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requirePermission("reviews.manage");
  const { status: raw, q: rawQ } = await searchParams;
  const q = rawQ?.trim() ?? "";
  const status = REVIEW_STATUSES.find((s) => s === raw);
  const db = await getDb();
  const filters: SQL[] = [];
  if (status) filters.push(eq(courseReviews.status, status));
  if (q) filters.push(or(ilike(courseReviews.body, `%${q}%`), ilike(users.name, `%${q}%`), ilike(courses.title, `%${q}%`))!);
  const [rows, byStatus] = await Promise.all([
    db.select({ review: courseReviews, name: users.name, email: users.email, gender: users.gender, avatarUrl: users.avatarUrl, userId: users.id, course: courses.title, slug: courses.slug, cohort: cohorts.name })
      .from(courseReviews)
      .innerJoin(users, eq(users.id, courseReviews.userId))
      .innerJoin(courses, eq(courses.id, courseReviews.courseId))
      .innerJoin(enrollments, eq(enrollments.id, courseReviews.enrollmentId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .where(filters.length ? and(...filters) : undefined).orderBy(desc(courseReviews.updatedAt)).limit(100),
    db.select({ status: courseReviews.status, n: count() }).from(courseReviews).groupBy(courseReviews.status),
  ]);
  const n = (s: ReviewStatus) => byStatus.find((b) => b.status === s)?.n ?? 0;

  return (
    <>
      <PageHeader title="Reviews" description="Ratings and reviews from students who finished a course. Published reviews appear on the course page with the student's first name and initial." />
      <TableToolbar
        action="/admin/reviews"
        q={q}
        placeholder="Search by student, course or words in the review…"
        hidden={{ status }}
        filters={[{ label: "All", href: "/admin/reviews", active: !status, count: byStatus.reduce((a, b) => a + b.n, 0) }, ...REVIEW_STATUSES.map((s) => ({ label: LABEL[s], href: `/admin/reviews?status=${s}`, active: status === s, count: n(s) }))]}
      />
      {rows.length ? (
        <div className="flex flex-col gap-4">
          {rows.map((r) => (
            <Card key={r.review.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar name={r.name} src={r.avatarUrl} gender={r.gender} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2"><Link href={`/admin/users/${r.userId}`} className="font-semibold text-ink hover:text-accent">{r.name}</Link><Badge tone={TONE[r.review.status]}>{LABEL[r.review.status]}</Badge></p>
                    <p className="text-sm text-muted"><Link href={`/courses/${r.slug}`} className="font-semibold text-body hover:text-accent">{r.course}</Link> · {r.cohort} · {relativeTime(r.review.updatedAt)}</p>
                    <span className="flex" aria-label={`${r.review.rating} out of 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} filled={i <= r.review.rating} className="size-4" />)}</span>
                    <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-body">{r.review.body}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {r.review.status !== "published" && <ActionButton action={setReviewStatus.bind(null, r.review.id, "published")} variant="primary" pendingText="…">Publish</ActionButton>}
                  {r.review.status !== "hidden" && <ActionButton action={setReviewStatus.bind(null, r.review.id, "hidden")} variant="danger" pendingText="…">Hide</ActionButton>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={MessageIcon} title={status ? "Nothing here" : "No reviews yet"}>Students can rate a course from My courses once they&apos;ve finished it.</EmptyState>}
    </>
  );
}
