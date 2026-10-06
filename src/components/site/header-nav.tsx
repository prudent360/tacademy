"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookIcon, BriefcaseIcon, ChartIcon, ChevronDown, CodeIcon, DatabaseIcon, LayersIcon, MenuIcon, MessageIcon, PaletteIcon, ShieldIcon, SparkIcon, SwapIcon, TrendIcon, XIcon, type Icon } from "@/components/icons";

export type MenuCourse = { slug: string; title: string; category: string; next: string };

const ABOUT: { href: string; label: string; text: string; icon: Icon }[] = [
  { href: "/#formats", label: "How we teach", text: "Live online, in person or hybrid", icon: SwapIcon },
  { href: "/#how", label: "How it works", text: "From enrolling to your certificate", icon: LayersIcon },
  { href: "/#faq", label: "FAQ", text: "Fees, schedules, certificates", icon: SparkIcon },
  { href: "/projects", label: "Student projects", text: "Real work by our graduates", icon: ChartIcon },
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
  `flex h-9 items-center gap-1 whitespace-nowrap rounded-full px-3.5 text-[15px] font-medium transition hover:bg-white/10 hover:text-white ${active || open ? "bg-white/[.12] text-white" : "text-white/90"}`;

/** Menu panels: a white card in columns, each with a small heading and links with a one-line description. */
const panelClass = "nav-menu-in rounded-[12px] bg-white p-3 text-left shadow-[0_32px_70px_-24px_rgba(24,19,64,.55),0_10px_22px_-14px_rgba(24,19,64,.25)] ring-1 ring-ink/[.06]";
const headingClass = "px-3 pb-2 pt-2 font-mono text-[11px] font-semibold uppercase tracking-[1.4px] text-muted";

function MenuLink({ href, title, text, onClick }: { href: string; title: string; text: string; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="group flex flex-col gap-0.5 rounded-[8px] px-3 py-2.5 transition hover:bg-panel">
      <span className="text-[15px] font-semibold text-ink group-hover:text-accent">{title}</span>
      <span className="text-[13px] leading-snug text-muted">{text}</span>
    </Link>
  );
}

const START: { href: string; title: string; text: string }[] = [
  { href: "/free-classes", title: "Free classes", text: "Try a live class before you enrol" },
  { href: "/enroll", title: "Enrol in a cohort", text: "Pick a start date and pay online" },
  { href: "/internships", title: "Internships", text: "Real projects, free for our graduates" },
  { href: "/teach-with-us", title: "Teach with us", text: "Share what you do every day" },
];

/** The header's menu: Courses and About open white panels on hover or click; phones get a full-screen menu. */
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
    document.querySelector<HTMLElement>(".site-header")?.style.setProperty("--nav-open", panel ? "1" : "0");
  }, [panel]);
  useEffect(() => {
    document.body.style.overflow = mobile ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobile]);

  const hoverOpen = (p: Panel) => { if (closeTimer.current) window.clearTimeout(closeTimer.current); setPanel(p); };
  const hoverClose = () => { closeTimer.current = window.setTimeout(() => setPanel(null), 140); };
  const is = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  const signIn = account
    ? <Link href={account.href} className="flex h-10 items-center gap-1.5 rounded-full bg-white px-5 text-[15px] font-semibold text-[#4f3fd7] transition hover:bg-white/90">{account.label} <ArrowRight className="size-4" /></Link>
    : <>
        <Link href="/login" className="flex h-10 items-center rounded-full px-5 text-[15px] font-semibold text-white ring-1 ring-white/35 transition hover:bg-white/10 hover:ring-white/60">Sign in</Link>
        <Link href="/enroll" className="flex h-10 items-center gap-1.5 rounded-full bg-white px-5 text-[15px] font-semibold text-[#4f3fd7] shadow-[0_10px_24px_-14px_rgba(0,0,0,.6)] transition hover:bg-white/90">Enrol now <ArrowRight className="size-4" /></Link>
      </>;

  return (
    <div ref={root} className="contents">
      <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
        <div className="relative" onMouseEnter={() => hoverOpen("courses")} onMouseLeave={hoverClose}>
          <button type="button" aria-expanded={panel === "courses"} aria-controls="menu-courses" onClick={() => setPanel(panel === "courses" ? null : "courses")} className={itemClass(is("/courses"), panel === "courses")}>
            Courses <ChevronDown className={`size-4 transition-transform ${panel === "courses" ? "rotate-180" : ""}`} />
          </button>
          {panel === "courses" && (
            <div id="menu-courses" className="absolute left-0 top-full z-40 w-[660px] pt-3">
              <div className={`${panelClass} grid grid-cols-[1.5fr_1fr] gap-2`}>
                <div className="flex flex-col">
                  <p className={headingClass}>Courses</p>
                  {courses.map((c) => <MenuLink key={c.slug} href={`/courses/${c.slug}`} title={c.title} text={`${c.category ? `${c.category} · ` : ""}${c.next}`} />)}
                  <Link href="/courses" className="mx-3 mt-1 flex items-center gap-1.5 border-t border-line pb-1 pt-3 text-sm font-semibold text-accent hover:text-accent-dark">View all {totalCourses} courses <ArrowRight className="size-4" /></Link>
                </div>
                <div className="flex flex-col border-l border-line pl-2">
                  <p className={headingClass}>Start here</p>
                  {START.map((l) => <MenuLink key={l.href} {...l} />)}
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
            <div id="menu-about" className="absolute left-0 top-full z-40 w-[520px] pt-3">
              <div className={`${panelClass} grid grid-cols-2 gap-2`}>
                <div className="flex flex-col">
                  <p className={headingClass}>Learn with us</p>
                  {ABOUT.slice(0, 4).map(({ href, label, text }) => <MenuLink key={href} href={href} title={label} text={text} onClick={() => setPanel(null)} />)}
                </div>
                <div className="flex flex-col border-l border-line pl-2">
                  <p className={headingClass}>Company</p>
                  {ABOUT.slice(4).map(({ href, label, text }) => <MenuLink key={href} href={href} title={label} text={text} onClick={() => setPanel(null)} />)}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="hidden shrink-0 items-center gap-3 lg:flex">{signIn}</div>

      <button type="button" onClick={() => setMobile(true)} aria-expanded={mobile} aria-label="Open menu" className="flex size-10 items-center justify-center rounded-full text-white ring-1 ring-white/35 transition hover:bg-white/10 lg:hidden"><MenuIcon /></button>

      {/* Rendered on <body>: the header moves with a CSS transform, which would trap a fixed overlay inside it. */}
      {mobile && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[60] flex flex-col bg-white text-ink lg:hidden">
          <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-5">
            {brand}
            <button type="button" onClick={() => setMobile(false)} aria-label="Close menu" className="flex size-10 items-center justify-center rounded-full border border-edge text-ink"><XIcon /></button>
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
              {[{ href: "/free-classes", label: "Free classes" }, { href: "/internships", label: "Internships" }, { href: "/teach-with-us", label: "Teach with us" }].map((l) => (
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
              ? <Link href={account.href} className="flex h-12 items-center justify-center rounded-full bg-accent text-base font-semibold text-white">{account.label}</Link>
              : <>
                  <Link href="/enroll" className="flex h-12 items-center justify-center rounded-full bg-accent text-base font-semibold text-white">Enrol now</Link>
                  <Link href="/login" className="flex h-12 items-center justify-center rounded-full border border-edge-strong text-base font-semibold text-ink">Sign in</Link>
                  <p className="pt-1 text-center text-sm text-muted">New here? <Link href="/register" className="font-semibold text-accent">Create a free account</Link></p>
                </>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
