import Link from "next/link";
import { ArrowRight, CalendarIcon, ClockIcon } from "@/components/icons";
import { ModeBadge } from "@/components/ui";
import { fromPrice, type CourseSummary } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { formatDateOnly } from "@/lib/time";
import { CourseArt } from "./course-art";

export function CourseCard({ course, currencies }: { course: CourseSummary; currencies: string[] }) {
  const price = fromPrice(course.cohorts.filter((c) => c.enrollmentOpen), currencies);
  const modes = [...new Set(course.cohorts.map((c) => c.deliveryMode))];
  return (
    <Link href={`/courses/${course.slug}`} className="group flex flex-col overflow-hidden rounded-[20px] border border-edge bg-white transition duration-300 hover:-translate-y-1 hover:border-accent-muted hover:shadow-[0_20px_48px_-22px_rgba(25,17,46,0.4)]">
      <div className="relative aspect-[16/9] overflow-hidden bg-accent-soft">
        {course.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.imageUrl} alt="" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <CourseArt seed={course.id} className="size-full" />
        )}
        {course.category && <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-accent">{course.category}</span>}
      </div>
      <div className="flex grow flex-col gap-3 p-5 md:p-6">
        <div className="flex flex-wrap gap-1.5">{modes.map((m) => <ModeBadge key={m} mode={m} />)}</div>
        <h3 className="font-display text-[22px] font-bold leading-snug text-ink transition group-hover:text-accent">{course.title}</h3>
        <p className="line-clamp-3 text-[15px] leading-relaxed text-muted">{course.summary}</p>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 pt-2 text-sm text-body">
          {course.durationWeeks && <span className="flex items-center gap-1.5"><ClockIcon className="size-4 text-muted" /> {course.durationWeeks} weeks</span>}
          <span className="flex items-center gap-1.5"><CalendarIcon className="size-4 text-muted" /> {course.nextCohort?.startDate ? `${course.nextCohort.startDate < new Date().toISOString().slice(0, 10) ? "Started" : "Starts"} ${formatDateOnly(course.nextCohort.startDate)}` : "Dates coming soon"}</span>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <p className="text-sm text-muted">
            {price === "free" ? <span className="font-display text-lg font-bold text-emerald-700">Free</span>
              : price ? <>From <span className="font-display text-lg font-bold text-ink">{formatMoney(price.amount, price.currency)}</span></>
              : "Register interest"}
          </p>
          <span className="flex items-center gap-1 text-sm font-semibold text-accent">View course <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
        </div>
      </div>
    </Link>
  );
}
