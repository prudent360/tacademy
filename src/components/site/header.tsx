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
 * The site's top bar. Over a coloured hero it starts transparent with white text; as the page scrolls it narrows,
 * shrinks and fills with the brand indigo, ending as a floating pill (Terac-style). Pages without a coloured hero
 * show the filled pill from the start. `--nav-p` (0 → 1 over the first scroll) is set by HeaderScrollState.
 */
export async function SiteHeader({ settings, user }: { settings: Settings; user: User | null }) {
  const summaries = await withCohorts((await getPublishedCourses()).filter((c) => c.kind === "course"));
  const today = new Date().toISOString().slice(0, 10);
  const courses: MenuCourse[] = summaries.slice(0, 6).map((c) => {
    const next = c.cohorts.filter((co) => co.enrollmentOpen && co.startDate && co.startDate >= today).map((co) => co.startDate!).sort()[0];
    return { slug: c.slug, title: c.title, category: c.category, next: next ? `Starts ${formatDateOnly(next)}` : c.cohorts.some((co) => co.enrollmentOpen) ? "Enrolling now" : "New dates soon" };
  });
  return (
    <header className="site-header group/header pointer-events-none sticky top-0 z-30 h-[4.75rem] px-3 pt-3 [--nav-base:1] [--nav-h-from:4rem] [--nav-h-to:3.5rem] [--nav-open:0] [--nav-p:0] [--nav-px-from:1rem] [--nav-px-to:.75rem] [--nav-w-from:1240px] [--nav-w-to:1240px] sm:px-5 sm:[--nav-px-from:1.5rem] md:h-[5.5rem] md:pt-4 md:[--nav-h-from:4.5rem] lg:[--nav-px-from:1.75rem] lg:[--nav-px-to:1rem] lg:[--nav-w-to:1080px]">
      <HeaderScrollState />
      <div
        className="pointer-events-auto relative mx-auto flex items-center justify-between gap-4 text-white"
        style={{
          maxWidth: "calc(var(--nav-w-from) + (var(--nav-w-to) - var(--nav-w-from)) * var(--nav-p))",
          height: "calc(var(--nav-h-from) + (var(--nav-h-to) - var(--nav-h-from)) * var(--nav-p))",
          paddingInline: "calc(var(--nav-px-from) + (var(--nav-px-to) - var(--nav-px-from)) * var(--nav-p))",
          transform: "translateY(calc(.25rem * var(--nav-p)))",
          borderRadius: "calc(2rem * max(var(--nav-p), var(--nav-base), var(--nav-open)))",
          backgroundColor: "color-mix(in srgb, #4f3fd7 calc(max(var(--nav-p), var(--nav-base), var(--nav-open)) * 100%), transparent)",
          boxShadow: "0 18px 40px -18px rgba(24, 19, 64, calc(.6 * var(--nav-p)))",
          transition: "background-color .2s, border-radius .2s",
        }}
      >
        <Brand settings={settings} tone="reversed" />
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
