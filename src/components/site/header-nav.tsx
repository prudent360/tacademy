"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookIcon, BriefcaseIcon, ChartIcon, ChevronDown, CodeIcon, DatabaseIcon, LayersIcon, MenuIcon, MessageIcon, PaletteIcon, ShieldIcon, SparkIcon, SwapIcon, TrendIcon, XIcon, type Icon } from "@/components/icons";

export type MenuCourse = { slug: string; title: string; category: string; next: string };

const ABOUT: { href: string; label: string; text: string; icon: Icon }[] = [
  { href: "/#formats", label: "How we teach", text: "Live online, in person or hybrid", icon: SwapIcon },
  { href: "/#how", label: "How it works", text: "From enrolling to your certificate", icon: LayersIcon },
  { href: "/#faq", label: "FAQ", text: "Fees, schedules, certificates", icon: SparkIcon },
  { href: "/careers", label: "Careers", text: "Join our team", icon: BriefcaseIcon },
  { href: "/contact", label: "Contact us", text: "Talk to the team", icon: MessageIcon },
];

/** An icon and colour for a course from its category (and title), so the list is easy to scan. First match wins. */
const COURSE_ICONS: { match: RegExp; icon: Icon; tone: string }[] = [
  { match: /\b(sql|database|postgres|mysql)\b/i, icon: DatabaseIcon, tone: "bg-cyan-soft text-cyan-ink" },
  { match: /\b(ai|artificial intelligence|machine learning|ml|deep learning|llm|prompt)\b/i, icon: SparkIcon, tone: "bg-amber-50 text-amber-700" },
  { match: /\b(web|full[- ]?stack|front[- ]?end|back[- ]?end|software|programming|python|javascript|react|coding|developer|development)\b/i, icon: CodeIcon, tone: "bg-emerald-50 text-emerald-700" },
  { match: /\b(design|ui|ux|graphic|figma|photoshop)\b/i, icon: PaletteIcon, tone: "bg-rose-50 text-rose-600" },
  { match: /\b(cyber|security)\b/i, icon: ShieldIcon, tone: "bg-slate-100 text-slate-700" },
  { match: /\b(engineering|cloud|devops|aws|azure)\b/i, icon: LayersIcon, tone: "bg-indigo-50 text-indigo-700" },
  { match: /\b(data|analytics|analysis|power ?bi|excel|tableau|statistics)\b/i, icon: ChartIcon, tone: "bg-accent-soft text-accent" },
  { match: /\b(business|marketing|product|management|sales|finance)\b/i, icon: TrendIcon, tone: "bg-sky-50 text-sky-700" },
];

function courseIcon(course: MenuCourse): { icon: Icon; tone: string } {
  // The title is more specific than the category (a "Data" course about SQL), so it's checked first.
  return COURSE_ICONS.find((c) => c.match.test(course.title)) ?? COURSE_ICONS.find((c) => c.match.test(course.category)) ?? { icon: BookIcon, tone: "bg-accent-soft text-accent" };
}

function CourseIcon({ course, className }: { course: MenuCourse; className: string }) {
  const { icon: CategoryIcon, tone } = courseIcon(course);
  return <span className={`flex shrink-0 items-center justify-center rounded-[5px] ${tone} ${className}`}><CategoryIcon className="size-[18px]" /></span>;
}

type Panel = "courses" | "about" | null;

const itemClass = (active: boolean, open = false) =>
  `relative flex h-10 items-center gap-1 whitespace-nowrap rounded-[5px] px-3 text-[15px] font-medium transition hover:bg-page hover:text-accent ${active || open ? "text-accent" : "text-ink"} ${active ? "after:absolute after:inset-x-3 after:-bottom-[13px] after:h-[2px] after:rounded-full after:bg-accent md:after:-bottom-[17px]" : ""}`;

/** The header's menu: Courses and About open panels on hover or click; phones get a full-screen menu. */
export function HeaderNav({ courses, totalCourses, account, brand }: { courses: MenuCourse[]; totalCourses: number; account: { href: string; label: string } | null; brand: React.ReactNode }) {
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel>(null);
  const [mobile, setMobile] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Close everything when the page changes, on Escape and on a click outside.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setPanel(null);
    setMobile(false);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setPanel(null); setMobile(false); } };
    const onClick = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setPanel(null); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, []);
  useEffect(() => {
    document.body.style.overflow = mobile ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobile]);

  const hoverOpen = (p: Panel) => { if (closeTimer.current) window.clearTimeout(closeTimer.current); setPanel(p); };
  const hoverClose = () => { closeTimer.current = window.setTimeout(() => setPanel(null), 140); };
  const is = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  const signIn = account
    ? <Link href={account.href} className="flex h-11 items-center justify-center rounded-[5px] bg-accent px-5 text-[15px] font-semibold text-white transition hover:bg-accent-dark">{account.label}</Link>
    : <>
        <Link href="/login" className="flex h-11 items-center px-2 text-[15px] font-semibold text-ink transition hover:text-accent">Sign in</Link>
        <Link href="/enroll" className="flex h-11 items-center justify-center gap-1.5 rounded-[5px] bg-accent px-5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-14px_rgba(79,63,215,.9)] transition hover:bg-accent-dark">Enrol now</Link>
      </>;

  return (
    <div ref={root} className="contents">
      {/* Softens the page behind an open panel so it stands out; clicking it closes the panel. */}
      <div
        aria-hidden="true"
        onClick={() => setPanel(null)}
        className={`fixed inset-0 -z-10 hidden bg-white/60 backdrop-blur-[2px] transition-opacity duration-200 lg:block ${panel ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
        <div className="relative" onMouseEnter={() => hoverOpen("courses")} onMouseLeave={hoverClose}>
          <button type="button" aria-expanded={panel === "courses"} aria-controls="menu-courses" onClick={() => setPanel(panel === "courses" ? null : "courses")} className={itemClass(is("/courses"), panel === "courses")}>
            Courses <ChevronDown className={`size-4 transition-transform ${panel === "courses" ? "rotate-180" : ""}`} />
          </button>
          {panel === "courses" && (
            <div id="menu-courses" className="absolute left-1/2 top-full z-40 w-[680px] -translate-x-1/2 pt-4">
              <div className="grid grid-cols-[1.45fr_1fr] overflow-hidden rounded-[5px] border border-edge-strong bg-white shadow-[0_40px_90px_-28px_rgba(24,19,64,.55),0_12px_24px_-12px_rgba(24,19,64,.18)]">
                <div className="flex flex-col gap-1 p-3">
                  <p className="px-3 pb-1 pt-2 font-mono text-[11px] font-semibold uppercase tracking-[1.4px] text-muted">Courses</p>
                  {courses.map((c) => (
                    <Link key={c.slug} href={`/courses/${c.slug}`} className="group flex items-start gap-3 rounded-[5px] px-3 py-2.5 transition hover:bg-panel">
                      <CourseIcon course={c} className="mt-0.5 size-9" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-semibold text-ink group-hover:text-accent">{c.title}</span>
                        <span className="text-xs text-muted">{c.category ? `${c.category} · ` : ""}{c.next}</span>
                      </span>
                    </Link>
                  ))}
                  <Link href="/courses" className="mx-3 mt-1 flex items-center gap-1.5 border-t border-line pb-1 pt-3 text-sm font-semibold text-accent hover:text-accent-dark">View all {totalCourses} courses <ArrowRight className="size-4" /></Link>
                </div>
                <div className="flex flex-col justify-between gap-4 bg-[linear-gradient(160deg,#4f3fd7_0%,#3d2fb8_100%)] p-6 text-white">
                  <div className="flex flex-col gap-2">
                    <span className="flex size-10 items-center justify-center rounded-[5px] bg-white/15"><BriefcaseIcon className="size-5" /></span>
                    <p className="font-display text-lg font-bold leading-snug">Finished a course? Get real experience.</p>
                    <p className="text-sm leading-relaxed text-white/80">Our internships are free for graduates of our courses.</p>
                  </div>
                  <Link href="/internships" className="inline-flex h-10 w-fit items-center gap-1.5 rounded-[5px] bg-white px-4 text-sm font-semibold text-ink hover:bg-[#f1efff]">See internships <ArrowRight className="size-4" /></Link>
                </div>
              </div>
            </div>
          )}
        </div>
        <Link href="/internships" className={itemClass(is("/internships"))}>Internships</Link>
        <Link href="/teach-with-us" className={itemClass(is("/teach-with-us"))}>Teach with us</Link>
        <div className="relative" onMouseEnter={() => hoverOpen("about")} onMouseLeave={hoverClose}>
          <button type="button" aria-expanded={panel === "about"} aria-controls="menu-about" onClick={() => setPanel(panel === "about" ? null : "about")} className={itemClass(is("/contact") || is("/careers"), panel === "about")}>
            About <ChevronDown className={`size-4 transition-transform ${panel === "about" ? "rotate-180" : ""}`} />
          </button>
          {panel === "about" && (
            <div id="menu-about" className="absolute left-1/2 top-full z-40 w-[340px] -translate-x-1/2 pt-4">
              <div className="flex flex-col gap-1 rounded-[5px] border border-edge-strong bg-white p-2 shadow-[0_40px_90px_-28px_rgba(24,19,64,.55),0_12px_24px_-12px_rgba(24,19,64,.18)]">
                {ABOUT.map(({ href, label, text, icon: ItemIcon }) => (
                  <Link key={href} href={href} onClick={() => setPanel(null)} className="group flex items-start gap-3 rounded-[5px] px-3 py-2.5 transition hover:bg-panel">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-accent-soft text-accent"><ItemIcon className="size-[18px]" /></span>
                    <span className="flex flex-col"><span className="text-[15px] font-semibold text-ink group-hover:text-accent">{label}</span><span className="text-xs text-muted">{text}</span></span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="hidden shrink-0 items-center gap-3 lg:flex">{signIn}</div>

      <button type="button" onClick={() => setMobile(true)} aria-expanded={mobile} aria-label="Open menu" className="flex size-11 items-center justify-center rounded-[5px] border border-edge text-ink lg:hidden"><MenuIcon /></button>

      {mobile && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
          <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-5">
            {brand}
            <button type="button" onClick={() => setMobile(false)} aria-label="Close menu" className="flex size-11 items-center justify-center rounded-[5px] border border-edge text-ink"><XIcon /></button>
          </div>
          <nav aria-label="Mobile" className="flex grow flex-col gap-7 overflow-y-auto px-5 py-6">
            <section className="flex flex-col gap-1">
              <p className="pb-1 font-mono text-[11px] font-semibold uppercase tracking-[1.4px] text-muted">Courses</p>
              {courses.map((c) => (
                <Link key={c.slug} href={`/courses/${c.slug}`} className="flex items-center gap-3 rounded-[5px] py-2.5">
                  <CourseIcon course={c} className="size-10" />
                  <span className="flex min-w-0 flex-col"><span className="truncate text-base font-semibold text-ink">{c.title}</span><span className="text-xs text-muted">{c.next}</span></span>
                </Link>
              ))}
              <Link href="/courses" className="flex items-center gap-1.5 pt-1 text-[15px] font-semibold text-accent">View all {totalCourses} courses <ArrowRight className="size-4" /></Link>
            </section>
            <section className="flex flex-col border-t border-line pt-5">
              {[{ href: "/internships", label: "Internships" }, { href: "/teach-with-us", label: "Teach with us" }].map((l) => (
                <Link key={l.href} href={l.href} className={`flex h-12 items-center justify-between font-display text-lg font-bold ${is(l.href) ? "text-accent" : "text-ink"}`}>{l.label}<ArrowRight className="size-4 text-muted" /></Link>
              ))}
            </section>
            <section className="flex flex-col gap-1 border-t border-line pt-5">
              <p className="pb-1 font-mono text-[11px] font-semibold uppercase tracking-[1.4px] text-muted">About</p>
              {ABOUT.map(({ href, label, icon: ItemIcon }) => (
                <Link key={href} href={href} onClick={() => setMobile(false)} className="flex h-11 items-center gap-3 text-base font-medium text-ink"><ItemIcon className="size-5 text-accent" />{label}</Link>
              ))}
            </section>
          </nav>
          <div className="flex shrink-0 flex-col gap-2 border-t border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {account
              ? <Link href={account.href} className="flex h-12 items-center justify-center rounded-[5px] bg-accent text-base font-semibold text-white">{account.label}</Link>
              : <>
                  <Link href="/enroll" className="flex h-12 items-center justify-center rounded-[5px] bg-accent text-base font-semibold text-white">Enrol now</Link>
                  <Link href="/login" className="flex h-12 items-center justify-center rounded-[5px] border border-edge-strong text-base font-semibold text-ink">Sign in</Link>
                  <p className="pt-1 text-center text-sm text-muted">New here? <Link href="/register" className="font-semibold text-accent">Create a free account</Link></p>
                </>}
          </div>
        </div>
      )}
    </div>
  );
}
