import Link from "next/link";
import type { Settings, User } from "@/db/schema";
import { withCohorts } from "@/lib/catalog";
import { getPublishedCourses } from "@/lib/data";
import { homeFor } from "@/lib/session";
import { formatDateOnly } from "@/lib/time";
import { Brand } from "./brand";
import { HeaderNav, type MenuCourse } from "./header-nav";
import { HeaderScrollState } from "./header-scroll";

/**
 * A white bar over the top of the page, inset from the edges: four main items (Courses and About open panels),
 * one main button and a quieter sign-in link. It stays pinned on large screens and scrolls away on phones.
 */
export async function SiteHeader({ settings, user }: { settings: Settings; user: User | null }) {
  const summaries = await withCohorts((await getPublishedCourses()).filter((c) => c.kind === "course"));
  const today = new Date().toISOString().slice(0, 10);
  const courses: MenuCourse[] = summaries.slice(0, 6).map((c) => {
    const next = c.cohorts.filter((co) => co.enrollmentOpen && co.startDate && co.startDate >= today).map((co) => co.startDate!).sort()[0];
    return { slug: c.slug, title: c.title, category: c.category, next: next ? `Starts ${formatDateOnly(next)}` : c.cohorts.some((co) => co.enrollmentOpen) ? "Enrolling now" : "New dates soon" };
  });
  return (
    <header className="site-header group/header relative z-30 px-3 pt-3 sm:px-5 md:pt-4 lg:sticky lg:top-0">
      <HeaderScrollState />
      <div className="relative mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 rounded-[5px] border border-edge/70 bg-white px-4 shadow-[0_10px_30px_-18px_rgba(24,19,64,.35)] transition-shadow duration-300 group-data-scrolled/header:shadow-[0_16px_40px_-18px_rgba(24,19,64,.45)] sm:px-6 md:h-[72px] lg:px-7">
        <Brand settings={settings} />
        <HeaderNav
          courses={courses}
          totalCourses={summaries.length}
          account={user ? { href: homeFor(user.role), label: "My dashboard" } : null}
          brand={<Brand settings={settings} />}
        />
      </div>
      {/* Kept for people without JavaScript: the menu's links. */}
      <noscript><nav aria-label="Main" className="mx-auto flex max-w-[1240px] flex-wrap gap-4 px-4 pt-2 text-sm"><Link href="/courses">Courses</Link><Link href="/internships">Internships</Link><Link href="/teach-with-us">Teach with us</Link><Link href="/contact">Contact</Link></nav></noscript>
    </header>
  );
}
