import type { Metadata } from "next";
import { AwardIcon, BookIcon, CalendarIcon, MonitorIcon } from "@/components/icons";
import { HeroHighlight, PageHero } from "@/components/site/page-hero";
import { formatDateOnly } from "@/lib/time";
import { CourseCard } from "@/components/site/course-card";
import { EmptyState } from "@/components/ui";
import { withCohorts } from "@/lib/catalog";
import { getPublishedCourses, getSettings } from "@/lib/data";
import type { DeliveryMode } from "@/db/schema";
import Link from "next/link";
import { MODE_LABEL } from "@/lib/utils";
import { pageMetadata, seoConfig } from "@/lib/seo";
import { visitorCurrencies } from "@/lib/visitor";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await seoConfig();
  return pageMetadata(seo, { title: "Courses", description: seo.coursesDescription || "Browse live online, in-person and hybrid courses.", path: "/courses" });
}

const FILTERS: (DeliveryMode | "all")[] = ["all", "virtual", "physical", "hybrid"];

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ mode?: string; category?: string; q?: string }> }) {
  const { mode = "all", category, q = "" } = await searchParams;
  const [settings, courses] = await Promise.all([getSettings(), getPublishedCourses()]);
  // Internships have their own page.
  const [all, { currencies }] = await Promise.all([withCohorts(courses.filter((c) => c.kind === "course")), visitorCurrencies(settings)]);
  const categories = [...new Set(all.map((c) => c.category).filter(Boolean))];
  const query = q.trim().toLowerCase();
  const shown = all.filter((c) => {
    const matchesQuery = !query || [c.title, c.summary, c.category, c.level].some((value) => value?.toLowerCase().includes(query));
    return matchesQuery && (mode === "all" || c.cohorts.some((co) => co.deliveryMode === mode)) && (!category || c.category === category);
  });
  const href = (next: { mode?: string; category?: string | null }) => {
    const params = new URLSearchParams();
    const m = next.mode ?? mode;
    const cat = next.category === undefined ? category : next.category;
    if (m && m !== "all") params.set("mode", m);
    if (cat) params.set("category", cat);
    const q = params.toString();
    return q ? `/courses?${q}` : "/courses";
  };
  const nextStart = all.flatMap((c) => c.cohorts.filter((co) => co.enrollmentOpen && co.startDate).map((co) => co.startDate!)).sort()[0];
  const pill = (active: boolean) => `flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${active ? "border-accent bg-accent text-white" : "border-edge-strong bg-white text-body hover:border-accent hover:text-accent"}`;

  return (
    <>
    <PageHero
      eyebrow="Courses"
      title={<>Find your next <HeroHighlight>course</HeroHighlight></>}
      lead="Every course runs in cohorts with a set timetable, taught live online, in person, or a mix of both."
      facts={[
        { icon: BookIcon, label: "Courses", value: `${all.length} to choose from` },
        { icon: MonitorIcon, label: "Formats", value: "Online, in person, hybrid" },
        { icon: CalendarIcon, label: "Next start", value: nextStart ? formatDateOnly(nextStart) : "New dates soon" },
        { icon: AwardIcon, label: "On completion", value: "Verified certificate" },
      ]}
    >
      {query && <p className="text-sm font-semibold text-cyan-light">Showing results for “{q.trim()}” · <Link href="/courses" className="underline underline-offset-4">Clear search</Link></p>}
    </PageHero>
    <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-12 sm:px-8 md:py-16">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Format">
          {FILTERS.map((f) => <Link key={f} href={href({ mode: f })} className={pill(mode === f)}>{f === "all" ? "All formats" : MODE_LABEL[f]}</Link>)}
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2" aria-label="Category">
            <Link href={href({ category: null })} className={pill(!category)}>All topics</Link>
            {categories.map((c) => <Link key={c} href={href({ category: c })} className={pill(category === c)}>{c}</Link>)}
          </div>
        )}
      </div>
      {shown.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((course) => <CourseCard key={course.id} course={course} currencies={currencies} />)}
        </div>
      ) : (
        <EmptyState icon={BookIcon} title="No courses match">Try a different format or topic, or check back soon for new cohorts.</EmptyState>
      )}
    </div>
    </>
  );
}
