import Link from "next/link";
import { ArrowRight, BookIcon, ClockIcon } from "@/components/icons";
import type { Course, Programme } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { CourseArt } from "./course-art";

export function ProgrammeCard({ programme, courses, fee }: { programme: Programme; courses: Pick<Course, "id" | "title">[]; fee: { amount: number; currency: string } | null }) {
  return (
    <Link href={`/programmes/${programme.slug}`} className="group flex flex-col overflow-hidden rounded-[5px] border border-edge bg-white transition duration-300 hover:-translate-y-1 hover:border-accent-muted hover:shadow-[0_20px_48px_-22px_rgba(24,19,64,0.4)]">
      <div className="relative aspect-[16/9] overflow-hidden bg-accent-soft">
        {programme.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={programme.imageUrl} alt="" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <CourseArt seed={programme.id + 1000} className="size-full" />
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-accent">{programme.category || "Programme"}</span>
      </div>
      <div className="flex grow flex-col gap-3 p-5 md:p-6">
        <h3 className="font-display text-[22px] font-bold leading-snug text-ink transition group-hover:text-accent">{programme.title}</h3>
        <p className="line-clamp-3 text-[15px] leading-relaxed text-muted">{programme.summary}</p>
        <ol className="flex flex-col gap-1 text-sm text-body">
          {courses.map((c, i) => <li key={c.id} className="flex gap-2"><span className="font-mono text-xs font-semibold leading-5 text-accent">{String(i + 1).padStart(2, "0")}</span>{c.title}</li>)}
        </ol>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 pt-2 text-sm text-body">
          <span className="flex items-center gap-1.5"><ClockIcon className="size-4 text-muted" /> {programme.duration}</span>
          <span className="flex items-center gap-1.5"><BookIcon className="size-4 text-muted" /> {courses.length} courses</span>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <p className="text-sm text-muted">{fee ? <span className="font-display text-lg font-bold text-ink">{formatMoney(fee.amount, fee.currency)}</span> : "Contact us for fees"}</p>
          <span className="flex items-center gap-1 text-sm font-semibold text-accent">View programme <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
        </div>
      </div>
    </Link>
  );
}
