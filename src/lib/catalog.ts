import "server-only";
import type { Cohort, Course } from "@/db/schema";
import { getCurrentCohorts, seatsTaken } from "./data";

export type CohortSummary = Cohort & { seatsLeft: number | null; full: boolean };
export type CourseSummary = Course & { cohorts: CohortSummary[]; nextCohort: CohortSummary | null };

/** Lowest price among the given cohorts in the preferred currency order, or "free". */
export function fromPrice(cohorts: Cohort[], currencies: string[]): { amount: number; currency: string } | "free" | null {
  if (!cohorts.length) return null;
  if (cohorts.some((c) => Object.keys(c.prices).length === 0)) return "free";
  for (const currency of currencies) {
    const amounts = cohorts.map((c) => c.prices[currency]).filter((a): a is number => typeof a === "number" && a > 0);
    if (amounts.length) return { amount: Math.min(...amounts), currency };
  }
  const first = Object.entries(cohorts[0].prices)[0];
  return first && typeof first[1] === "number" ? { amount: first[1], currency: first[0] } : null;
}

export function isFree(cohort: Cohort): boolean {
  return Object.values(cohort.prices).every((v) => !v);
}

/** Attaches current cohorts (with remaining seats) to each course. */
export async function withCohorts(courses: Course[]): Promise<CourseSummary[]> {
  const cohorts = await getCurrentCohorts(courses.map((c) => c.id));
  const taken = await seatsTaken(cohorts.map((c) => c.id));
  const summaries: CohortSummary[] = cohorts.map((c) => {
    const seatsLeft = c.capacity ? Math.max(0, c.capacity - (taken.get(c.id) ?? 0)) : null;
    return { ...c, seatsLeft, full: seatsLeft === 0 };
  });
  return courses.map((course) => {
    const own = summaries.filter((c) => c.courseId === course.id);
    const today = new Date().toISOString().slice(0, 10);
    const open = own.filter((c) => c.enrollmentOpen && !c.full);
    // Prefer a cohort that hasn't started yet over one already running.
    const nextCohort = open.find((c) => !c.startDate || c.startDate >= today) ?? open[0] ?? null;
    return { ...course, cohorts: own, nextCohort };
  });
}
