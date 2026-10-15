import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, programmeCourses, programmes, type Course, type PriceMap, type Programme } from "@/db/schema";
import type { CourseSummary } from "./catalog";

export async function getPublishedProgrammes(): Promise<Programme[]> {
  return (await getDb()).select().from(programmes).where(eq(programmes.published, true)).orderBy(asc(programmes.sortOrder), asc(programmes.title));
}

export async function getProgrammeBySlug(slug: string): Promise<Programme | null> {
  const [row] = await (await getDb()).select().from(programmes).where(and(eq(programmes.slug, slug), eq(programmes.published, true)));
  return row ?? null;
}

/** Each programme's courses in the order they're taken. `publishedOnly` leaves out draft courses (for the website). */
export async function programmeCourseMap(programmeIds: number[], { publishedOnly = false } = {}): Promise<Map<number, Course[]>> {
  const out = new Map<number, Course[]>();
  if (!programmeIds.length) return out;
  const inProgrammes = inArray(programmeCourses.programmeId, programmeIds);
  const rows = await (await getDb())
    .select({ programmeId: programmeCourses.programmeId, course: courses })
    .from(programmeCourses)
    .innerJoin(courses, eq(courses.id, programmeCourses.courseId))
    .where(publishedOnly ? and(inProgrammes, eq(courses.published, true)) : inProgrammes)
    .orderBy(asc(programmeCourses.position));
  for (const { programmeId, course } of rows) out.set(programmeId, [...(out.get(programmeId) ?? []), course]);
  return out;
}

/** The first of the visitor's currencies the programme has a fee in. */
export function programmeFee(prices: PriceMap, currencies: string[]): { amount: number; currency: string } | null {
  for (const currency of [...currencies, ...Object.keys(prices)]) {
    const amount = prices[currency];
    if (amount && amount > 0) return { amount, currency };
  }
  return null;
}

/**
 * What the courses would cost taken one by one (each course's cheapest open cohort), in one currency.
 * Null unless every course has a price in that currency, so the comparison is never misleading.
 */
export function separateTotal(summaries: CourseSummary[], currency: string): number | null {
  if (!summaries.length) return null;
  let total = 0;
  for (const course of summaries) {
    const amounts = course.cohorts.filter((c) => c.enrollmentOpen).map((c) => c.prices[currency]).filter((a): a is number => typeof a === "number" && a > 0);
    if (!amounts.length) return null;
    total += Math.min(...amounts);
  }
  return total;
}
