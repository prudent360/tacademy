import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { ArrowRight, AwardIcon, BookIcon, CalendarIcon, ExternalIcon } from "@/components/icons";
import { ProgressBar } from "@/components/portal/dash";
import { CourseArt } from "@/components/site/course-art";
import { Badge, Card, EmptyState, ModeBadge, PageHeader, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { certificates, classSessions, courseModules, lessonProgress, lessons } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { reviewableFor } from "@/lib/reviews";
import { submitReview } from "@/app/actions/reviews";
import { ReviewForm } from "@/components/portal/review-form";
import { fromPrice, isFree, withCohorts } from "@/lib/catalog";
import { getPublishedCourses, getSettings, getStudentCohorts, graduateFor } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { formatDateOnly, formatSessionRange } from "@/lib/time";
import { visitorCurrencies } from "@/lib/visitor";

export const metadata: Metadata = { title: "My courses" };

/** A student's courses, and the other courses and internships they could join next, without leaving the portal. */
export default async function MyCoursesPage() {
  const user = await requireUser();
  const reviewable = await reviewableFor(user.id);
  const settings = await getSettings();
  const db = await getDb();
  const [mine, published, { currencies }] = await Promise.all([getStudentCohorts(user.id), getPublishedCourses(), visitorCurrencies(settings)]);
  const cohortIds = mine.map((row) => row.cohort.id);
  const enrollmentIds = mine.map((row) => row.enrollment.id);
  const courseIds = [...new Set(mine.map((row) => row.course.id))];

  const [lessonTotals, lessonsDone, nextClasses, issued, catalogue] = await Promise.all([
    courseIds.length ? db.select({ courseId: courseModules.courseId, n: count() }).from(lessons).innerJoin(courseModules, eq(courseModules.id, lessons.moduleId)).where(and(inArray(courseModules.courseId, courseIds), eq(courseModules.published, true), eq(lessons.published, true))).groupBy(courseModules.courseId) : [],
    enrollmentIds.length ? db.select({ enrollmentId: lessonProgress.enrollmentId, n: count() }).from(lessonProgress).innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId)).innerJoin(courseModules, eq(courseModules.id, lessons.moduleId)).where(and(inArray(lessonProgress.enrollmentId, enrollmentIds), eq(lessons.published, true), eq(courseModules.published, true), sql`${lessonProgress.completedAt} is not null`)).groupBy(lessonProgress.enrollmentId) : [],
    cohortIds.length ? db.select().from(classSessions).where(and(inArray(classSessions.cohortId, cohortIds), gte(classSessions.endsAt, new Date()), eq(classSessions.cancelled, false))).orderBy(asc(classSessions.startsAt)) : [],
    enrollmentIds.length ? db.select().from(certificates).where(and(inArray(certificates.enrollmentId, enrollmentIds), isNull(certificates.revokedAt))) : [],
    withCohorts(published),
  ]);

  // Other courses with a cohort open for enrolment, leaving out ones they're already on.
  const others = catalogue.filter((course) => course.nextCohort && !courseIds.includes(course.id));
  const graduateOf = new Map<number, boolean>();
  for (const course of others) if (course.nextCohort?.graduatesFree) graduateOf.set(course.id, await graduateFor(user.id, course.id));
  const current = mine.filter((row) => row.enrollment.status === "active");
  const finished = mine.filter((row) => row.enrollment.status === "completed");

  return (
    <>
      <PageHeader title="My courses" description="Your courses, and what you could take next." />
      {reviewable.length > 0 && (
        <section id="reviews" className="scroll-mt-24">
          <Card title="Rate your courses">
            <div className="flex flex-col gap-6">
              {reviewable.map((r) => (
                <div key={r.enrollmentId} className="flex flex-col gap-3 border-b border-line pb-6 last:border-0 last:pb-0">
                  <p className="flex flex-wrap items-center gap-2"><span className="font-display font-bold text-ink">{r.courseTitle}</span><span className="text-sm text-muted">{r.cohortName}</span>{r.review && <Badge tone={r.review.status === "published" ? "green" : r.review.status === "hidden" ? "neutral" : "amber"}>{r.review.status === "published" ? "Published" : r.review.status === "hidden" ? "Not shown" : "Awaiting approval"}</Badge>}</p>
                  <ReviewForm action={submitReview.bind(null, r.enrollmentId)} initial={r.review ? { rating: r.review.rating, body: r.review.body } : undefined} />
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {mine.length ? (
        <div className="flex flex-col gap-4">
          {[...current, ...finished].map(({ enrollment, cohort, course }) => {
            const total = lessonTotals.find((t) => t.courseId === course.id)?.n ?? 0;
            const done = lessonsDone.find((d) => d.enrollmentId === enrollment.id)?.n ?? 0;
            const next = nextClasses.find((s) => s.cohortId === cohort.id);
            const certificate = issued.find((c) => c.enrollmentId === enrollment.id);
            const completed = enrollment.status === "completed";
            return (
              <Card key={enrollment.id} padded={false}>
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center md:p-6">
                  <div className="relative hidden aspect-[16/10] w-44 shrink-0 overflow-hidden rounded-[10px] bg-accent-soft sm:block">
                    {course.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={course.imageUrl} alt="" className="size-full object-cover" />
                    ) : <CourseArt seed={course.id} className="size-full" />}
                  </div>
                  <div className="flex min-w-0 grow flex-col gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <ModeBadge mode={cohort.deliveryMode} />
                      {course.kind === "internship" && <Badge tone="cyan">Internship</Badge>}
                      {completed && <Badge tone="green">Completed</Badge>}
                    </div>
                    <p className="font-display text-xl font-bold leading-snug text-ink">{course.title}</p>
                    <p className="text-sm text-muted">{cohort.name}{cohort.startDate ? ` · ${formatDateOnly(cohort.startDate)}${cohort.endDate ? ` – ${formatDateOnly(cohort.endDate)}` : ""}` : ""}</p>
                    {total > 0 && <div className="max-w-md"><ProgressBar value={done} max={total} label="Lessons" detail={`${done}/${total}`} /></div>}
                    {!completed && <p className="flex items-center gap-1.5 text-sm text-body"><CalendarIcon className="size-4 shrink-0 text-muted" />{next ? <>Next live class: <strong className="font-semibold text-ink">{next.title}</strong>, {formatSessionRange(next.startsAt, next.endsAt, settings.timezone)}</> : "No live classes scheduled yet"}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
                    <Link href={`/dashboard/cohorts/${cohort.id}`} className={buttonClass.primary}>Open my course</Link>
                    {certificate && <Link href={`/certificates/${certificate.code}`} target="_blank" className={buttonClass.secondary}><AwardIcon className="size-4" /> Certificate</Link>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><EmptyState icon={BookIcon} title="You're not on a course yet">Pick one below to get started. Your classes, lessons and assignments will appear here.</EmptyState></Card>
      )}

      {others.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 pt-2">
            <h2 className="font-display text-xl font-bold text-ink">More courses</h2>
            <p className="text-sm text-muted">Open for enrolment now.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {others.map((course) => {
              const cohort = course.nextCohort!;
              const freeForYou = isFree(cohort) || (cohort.graduatesFree && graduateOf.get(course.id));
              const price = fromPrice([cohort], currencies);
              return (
                <article key={course.id} className="flex flex-col overflow-hidden rounded-[14px] border border-edge bg-white">
                  <div className="relative aspect-[16/7] overflow-hidden bg-accent-soft">
                    {course.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={course.imageUrl} alt="" className="size-full object-cover" />
                    ) : <CourseArt seed={course.id} className="size-full" />}
                    {course.category && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-accent">{course.category}</span>}
                  </div>
                  <div className="flex grow flex-col gap-3 p-5">
                    <div className="flex flex-wrap gap-1.5">
                      <ModeBadge mode={cohort.deliveryMode} />
                      {course.kind === "internship" && <Badge tone="cyan">Internship</Badge>}
                      {cohort.graduatesFree && !isFree(cohort) && <Badge tone="green">{graduateOf.get(course.id) ? "Free for you" : "Free for graduates"}</Badge>}
                    </div>
                    <h3 className="font-display text-lg font-bold leading-snug text-ink">{course.title}</h3>
                    {course.summary && <p className="line-clamp-2 text-sm leading-relaxed text-muted">{course.summary}</p>}
                    <p className="flex items-center gap-1.5 text-sm text-body"><CalendarIcon className="size-4 text-muted" /> {cohort.startDate ? `${cohort.startDate < new Date().toISOString().slice(0, 10) ? "Started" : "Starts"} ${formatDateOnly(cohort.startDate)}` : "Dates coming soon"}{cohort.seatsLeft !== null && cohort.seatsLeft <= 5 ? ` · ${cohort.seatsLeft} ${cohort.seatsLeft === 1 ? "place" : "places"} left` : ""}</p>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                      <p className="text-sm text-muted">
                        {freeForYou || price === "free" ? <span className="font-display text-lg font-bold text-emerald-700">Free</span>
                          : price ? <span className="font-display text-lg font-bold text-ink">{formatMoney(price.amount, price.currency)}</span>
                          : null}
                      </p>
                      <span className="flex items-center gap-3">
                        <Link href={`/courses/${course.slug}`} target="_blank" className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">Details <ExternalIcon className="size-3.5" /></Link>
                        <Link href={`/enroll?cohort=${cohort.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent-dark">Enrol <ArrowRight className="size-4" /></Link>
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
