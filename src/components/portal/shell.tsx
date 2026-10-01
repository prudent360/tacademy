"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BrandMark } from "@/components/brand-mark";
import { AwardIcon, BellIcon, BookIcon, BriefcaseIcon, CalendarIcon, CardIcon, ChartIcon, ChevronDown, ClipboardIcon, CogIcon, DatabaseIcon, DownloadIcon, ExternalIcon, GridIcon, IdCardIcon, LayersIcon, LogoutIcon, MenuIcon, UserIcon, UsersIcon, XIcon, type Icon } from "@/components/icons";
import type { Role } from "@/db/schema";

/** A link, or (with children) a dropdown whose first child is its main page. `href` may carry a ?tab= query. */
type NavItem = { href: string; label: string; icon: Icon; exact?: boolean; badge?: number; also?: string[]; children?: NavItem[] };
type NavGroup = { label: string; items: NavItem[] };
export type ShellNotification = { id: number; title: string; body: string; href: string | null; read: boolean; when: string };

const ROLE_LABEL: Record<Role, string> = { admin: "Administrator", instructor: "Instructor", student: "Student" };

const SETTINGS_TABS: [string, string][] = [
  ["general", "General"], ["branding", "Branding"], ["payments", "Payments"], ["email", "Email"], ["templates", "Email templates"],
  ["reminders", "Reminders"], ["seo", "SEO"], ["video", "Video"], ["ai", "AI"],
];

function navFor(role: Role, counts: { unread: number; toGrade: number; newApplications: number; newInstructorApplications: number }): NavGroup[] {
  const learning: NavGroup = {
    label: "Learning",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: GridIcon, exact: true },
      { href: "/dashboard/schedule", label: "Timetable", icon: CalendarIcon },
      { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardIcon },
      { href: "/dashboard/certificates", label: "Certificates", icon: AwardIcon },
      { href: "/dashboard/courses", label: "My courses", icon: BookIcon, also: ["/dashboard/cohorts"] },
    ],
  };
  const teaching: NavGroup = {
    label: "Teaching",
    items: [
      { href: "/teach", label: role === "admin" ? "Teaching" : "Dashboard", icon: role === "admin" ? LayersIcon : GridIcon, exact: true },
      { href: "/teach/grading", label: "To grade", icon: ClipboardIcon, badge: counts.toGrade },
      { href: "/teach/schedule", label: "Timetable", icon: CalendarIcon },
      { href: "/teach/datasets", label: "SQL datasets", icon: DatabaseIcon },
    ],
  };
  const overview: NavGroup = {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: GridIcon, exact: true },
      { href: "/admin/insights", label: "Insights", icon: ChartIcon },
    ],
  };
  const programmes: NavGroup = {
    label: "Programmes",
    items: [
      { href: "/admin/courses", label: "Courses & cohorts", icon: BookIcon, also: ["/admin/cohorts", "/teach/cohorts", "/admin/modules", "/admin/lessons"] },
      {
        href: "/admin/internships", label: "Internships", icon: BriefcaseIcon, children: [
          { href: "/admin/internships", label: "Programmes", icon: BriefcaseIcon },
          { href: "/admin/applications", label: "Applications", icon: ClipboardIcon, badge: counts.newApplications },
        ],
      },
      { href: "/admin/certificates", label: "Certificates", icon: AwardIcon },
    ],
  };
  const peopleAndSales: NavGroup = {
    label: "People & sales",
    items: [
      {
        href: "/admin/users", label: "People", icon: UsersIcon, children: [
          { href: "/admin/users", label: "Everyone", icon: UsersIcon },
          { href: "/admin/instructor-applications", label: "Instructor applications", icon: ClipboardIcon, badge: counts.newInstructorApplications },
        ],
      },
      {
        href: "/admin/payments", label: "Payments", icon: CardIcon, children: [
          { href: "/admin/payments", label: "All payments", icon: CardIcon },
          { href: "/admin/discounts", label: "Discount codes", icon: CardIcon },
        ],
      },
      { href: "/admin/leads", label: "Curriculum requests", icon: DownloadIcon },
    ],
  };
  const system: NavGroup = {
    label: "System",
    items: [
      {
        href: "/admin/settings", label: "Settings", icon: CogIcon,
        children: SETTINGS_TABS.map(([tab, label]) => ({ href: tab === "general" ? "/admin/settings" : `/admin/settings?tab=${tab}`, label, icon: CogIcon, ...(tab === "templates" ? { also: ["/admin/emails"] } : {}) })),
      },
    ],
  };
  const account: NavGroup = {
    label: "Account",
    items: [
      ...(role === "student" ? [{ href: "/dashboard/payments", label: "Payments", icon: CardIcon }] : []),
      { href: "/notifications", label: "Notifications", icon: BellIcon, badge: counts.unread },
      { href: "/account", label: "Profile & security", icon: UserIcon },
    ],
  };
  if (role === "admin") return [overview, programmes, peopleAndSales, teaching, system, account];
  if (role === "instructor") return [teaching, account];
  return [learning, account];
}

function bottomNavFor(role: Role): NavItem[] {
  if (role === "admin") return [
    { href: "/admin", label: "Home", icon: GridIcon, exact: true },
    { href: "/admin/courses", label: "Courses", icon: BookIcon },
    { href: "/admin/payments", label: "Payments", icon: CardIcon },
    { href: "/admin/users", label: "People", icon: UsersIcon },
    { href: "/account", label: "Account", icon: UserIcon },
  ];
  if (role === "instructor") return [
    { href: "/teach", label: "Home", icon: GridIcon, exact: true },
    { href: "/teach/grading", label: "Grade", icon: ClipboardIcon },
    { href: "/teach/schedule", label: "Timetable", icon: CalendarIcon },
    { href: "/notifications", label: "Alerts", icon: BellIcon },
    { href: "/account", label: "Account", icon: UserIcon },
  ];
  return [
    { href: "/dashboard", label: "Home", icon: GridIcon, exact: true },
    { href: "/dashboard/schedule", label: "Timetable", icon: CalendarIcon },
    { href: "/dashboard/assignments", label: "Tasks", icon: ClipboardIcon },
    { href: "/notifications", label: "Alerts", icon: BellIcon },
    { href: "/account", label: "Account", icon: UserIcon },
  ];
}

/** Whether a link is the current page. Links with ?tab= match that tab; the bare settings link matches the default tab. */
function isActive(pathname: string, tab: string | null, item: NavItem): boolean {
  if (item.children) return item.children.some((child) => isActive(pathname, tab, child));
  const [path, query] = item.href.split("?");
  if (query !== undefined || path === "/admin/settings") {
    const wanted = new URLSearchParams(query ?? "").get("tab");
    if (pathname === path) return (tab ?? null) === wanted || (!wanted && (!tab || tab === "general"));
    return (item.also ?? []).some((h) => pathname === h || pathname.startsWith(`${h}/`));
  }
  return item.exact ? pathname === item.href : [item.href, ...(item.also ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
}

const NAV_STATE_KEY = "portal-nav-open";
const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
function readNavState(): string | null {
  try { return window.localStorage.getItem(NAV_STATE_KEY); } catch { return null; }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function Avatar({ name, src, className = "size-9" }: { name: string; src: string | null; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
  return <span aria-hidden="true" className={`${className} flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent`}>{initials(name)}</span>;
}

/** Closes a popover when clicking outside it or pressing Escape. */
function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

function NotificationMenu({ items, unread, markAllRead }: { items: ShellNotification[]; unread: number; markAllRead: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative flex size-10 cursor-pointer items-center justify-center rounded-full text-body hover:bg-page">
        <BellIcon />
        {unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-edge bg-white shadow-[0_24px_48px_-16px_rgba(24,19,64,0.3)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display font-bold text-ink">Notifications</p>
            {unread > 0 && <button type="button" onClick={async () => { await markAllRead(); }} className="cursor-pointer text-xs font-semibold text-accent hover:text-accent-dark">Mark all read</button>}
          </div>
          <ul className="max-h-[360px] divide-y divide-line overflow-y-auto">
            {items.length ? items.map((n) => (
              <li key={n.id}>
                <Link href={n.href ?? "/notifications"} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-panel">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={`text-sm ${n.read ? "text-body" : "font-semibold text-ink"}`}>{n.title}</span>
                    {n.body && <span className="truncate text-xs text-muted">{n.body}</span>}
                    <span className="text-[11px] text-muted">{n.when}</span>
                  </span>
                </Link>
              </li>
            )) : <li className="px-4 py-8 text-center text-sm text-muted">You&apos;re all caught up.</li>}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-accent hover:bg-panel">View all notifications</Link>
        </div>
      )}
    </div>
  );
}

/** Just the person's photo in the top bar; the menu holds their details and account links. */
function UserMenu({ user, studentId, logout }: { user: { name: string; email: string; avatarUrl: string | null; role: Role }; studentId?: string; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={`Account menu for ${user.name}`} title={user.name} className="flex cursor-pointer rounded-full ring-2 ring-transparent ring-offset-2 transition hover:ring-accent-muted aria-expanded:ring-accent">
        <Avatar name={user.name} src={user.avatarUrl} className="size-9" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-[14px] border border-edge bg-white p-1.5 shadow-[0_24px_48px_-16px_rgba(24,19,64,0.3)]">
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{ROLE_LABEL[user.role]} · {user.email}</p>
            {studentId && <div className="mt-2"><StudentIdPill id={studentId} /></div>}
          </div>
          <Link href="/account" onClick={() => setOpen(false)} className="mt-1 flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-body hover:bg-page"><UserIcon className="size-4" /> Profile & security</Link>
          <Link href="/" onClick={() => setOpen(false)} className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-body hover:bg-page"><ExternalIcon className="size-4" /> View website</Link>
          <form action={logout}>
            <button type="submit" className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50"><LogoutIcon className="size-4" /> Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}

/** The student's ID in the account menu; tapping it copies it (handy when contacting support or paying by transfer). */
/** Level as a ring that fills towards the next level, with XP beside it (text hidden on small screens). */
function LevelBadge({ xp }: { xp: { level: number; total: number; percent: number; toNext: number } }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(100, Math.max(0, xp.percent));
  return (
    <Link href="/dashboard" title={`Level ${xp.level} · ${xp.total.toLocaleString("en-GB")} XP · ${xp.toNext.toLocaleString("en-GB")} XP to level ${xp.level + 1}`} className="group mr-1 flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition hover:bg-page sm:pr-3">
      <span className="relative flex size-9 shrink-0 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id="level-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4f3fd7" /><stop offset="100%" stopColor="#22c3d6" /></linearGradient>
          </defs>
          <circle cx="18" cy="18" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-accent-soft" />
          <circle cx="18" cy="18" r={radius} fill="none" stroke="url(#level-ring)" strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - filled / 100)} className="transition-[stroke-dashoffset] duration-700" />
        </svg>
        <span className="font-display text-[13px] font-extrabold text-accent">{xp.level}</span>
      </span>
      <span className="hidden flex-col leading-tight sm:flex">
        <span className="text-sm font-bold text-ink">{xp.total.toLocaleString("en-GB")} <span className="font-semibold text-muted">XP</span></span>
        <span className="text-[11px] font-medium text-muted">{xp.toNext.toLocaleString("en-GB")} to Lv {xp.level + 1}</span>
      </span>
    </Link>
  );
}

function StudentIdPill({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {})}
      className="flex cursor-pointer items-center gap-2 rounded-full border border-accent-muted/60 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent shadow-sm transition hover:border-accent"
      aria-label={`Student ID ${id}. Copy`}
    >
      <IdCardIcon className="size-4" />
      <span className="text-accent/70">Student ID</span>
      <span className="font-mono tracking-wide">{copied ? "Copied" : id}</span>
    </button>
  );
}

export function PortalShell({ children, role, user, siteName, logoUrl, unread, toGrade, newApplications = 0, newInstructorApplications = 0, notifications, studentId, xp, logout, markAllRead }: {
  children: React.ReactNode;
  role: Role;
  user: { name: string; email: string; avatarUrl: string | null };
  siteName: string;
  logoUrl: string | null;
  unread: number;
  toGrade: number;
  /** Admins: internship applications waiting for review. */
  newApplications?: number;
  newInstructorApplications?: number;
  notifications: ShellNotification[];
  /** Shown instead of the date for students. */
  studentId?: string;
  /** Students' level, XP and progress to the next level. */
  xp?: { level: number; total: number; percent: number; toNext: number };
  logout: () => Promise<void>;
  markAllRead: () => Promise<void>;
}) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const [drawer, setDrawer] = useState(false);
  const groups = navFor(role, { unread, toGrade, newApplications, newInstructorApplications });
  // Which groups and dropdowns are open is remembered in this browser; until changed, groups start open and
  // dropdowns open when they hold the current page.
  const storedNav = useSyncExternalStore(subscribeStorage, readNavState, () => null);
  const savedNav = useMemo<Record<string, boolean>>(() => { try { return JSON.parse(storedNav ?? "{}"); } catch { return {}; } }, [storedNav]);
  const [navOverrides, setNavOverrides] = useState<Record<string, boolean>>({});
  const isOpen = (key: string, fallback: boolean) => navOverrides[key] ?? savedNav[key] ?? fallback;
  function toggleNav(key: string, current: boolean) {
    const next = { ...savedNav, ...navOverrides, [key]: !current };
    setNavOverrides(next);
    try { window.localStorage.setItem(NAV_STATE_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  }
  const bottom = bottomNavFor(role);
  const home = role === "admin" ? "/admin" : role === "instructor" ? "/teach" : "/dashboard";
  const [first, ...rest] = siteName.split(" ");

  const sidebar = (
    <aside className="flex h-full w-[276px] flex-col border-r border-edge bg-white text-ink shadow-[12px_0_40px_-36px_rgba(24,19,64,.35)]">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
        <Link href={home} className="flex items-center gap-2.5" onClick={() => setDrawer(false)}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={siteName} className="h-11 w-auto max-w-[210px] object-contain" />
          ) : (
            <>
              <BrandMark className="size-8" />
              <span className="font-display text-lg font-extrabold tracking-[-0.4px] text-ink">{first}{rest.length > 0 && <span className="ml-1 font-semibold text-accent">{rest.join(" ")}</span>}</span>
            </>
          )}
        </Link>
        <button type="button" onClick={() => setDrawer(false)} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-panel hover:text-ink lg:hidden" aria-label="Close menu"><XIcon /></button>
      </div>
      <nav aria-label="Portal" className="portal-nav-scroll flex grow flex-col gap-2 overflow-y-auto px-3 py-5">
        {groups.map((group) => {
          const containsActive = group.items.some((item) => isActive(pathname, tab, item));
          const open = isOpen(`group:${group.label}`, true);
          const groupCount = group.items.reduce((total, item) => total + (item.badge ?? 0) + (item.children ?? []).reduce((sum, child) => sum + (child.badge ?? 0), 0), 0);
          return (
          <section key={group.label} className="border-b border-line pb-2 last:border-0">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`portal-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => toggleNav(`group:${group.label}`, open)}
              className={`group flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[1.6px] transition hover:bg-panel hover:text-ink ${containsActive ? "text-accent" : "text-muted/80"}`}
            >
              <span className="grow">{group.label}</span>
              {groupCount > 0 && <span className="flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[9px] tracking-normal text-white">{groupCount > 99 ? "99+" : groupCount}</span>}
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`} />
            </button>
            <div id={`portal-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`} className={`sidebar-group-grid ${open ? "is-open" : ""}`}>
              <div className="min-h-0">
                <div className="flex flex-col gap-0.5 pb-1 pt-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, tab, item);
              const IconComponent = item.icon;
              if (item.children) {
                const itemKey = `item:${item.label}`;
                const expanded = isOpen(itemKey, active);
                const listId = `portal-sub-${item.label.toLowerCase().replace(/\s+/g, "-")}`;
                const childBadges = item.children.reduce((sum, child) => sum + (child.badge ?? 0), 0);
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={listId}
                      onClick={() => toggleNav(itemKey, expanded)}
                      className={`group relative flex h-10 w-full cursor-pointer items-center gap-3 rounded-[5px] px-3 text-left text-sm font-medium transition duration-200 ${active ? "text-accent" : "text-body hover:bg-panel hover:text-ink"}`}
                    >
                      <IconComponent className={`size-[18px] ${active ? "text-accent" : "text-muted group-hover:text-ink"}`} />
                      <span className="grow">{item.label}</span>
                      {!expanded && childBadges > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{childBadges > 99 ? "99+" : childBadges}</span>}
                      <ChevronDown className={`size-4 text-muted transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`} />
                    </button>
                    <div id={listId} className={`sidebar-group-grid ${expanded ? "is-open" : ""}`}>
                      <div className="min-h-0">
                        <div className="ml-[21px] flex flex-col gap-0.5 border-l border-line py-0.5 pl-3">
                          {item.children.map((child) => {
                            const childActive = isActive(pathname, tab, child);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setDrawer(false)}
                                aria-current={childActive ? "page" : undefined}
                                className={`flex h-9 items-center gap-2 rounded-[5px] px-3 text-[13px] font-medium transition ${childActive ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-panel hover:text-ink"}`}
                              >
                                <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${childActive ? "bg-accent" : "bg-edge-strong"}`} />
                                {child.label}
                                {Boolean(child.badge) && <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{child.badge! > 99 ? "99+" : child.badge}</span>}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawer(false)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex h-10 items-center gap-3 rounded-[5px] px-3 text-sm font-medium transition duration-200 ${active ? "bg-accent-soft font-semibold text-accent" : "text-body hover:translate-x-0.5 hover:bg-panel hover:text-ink"}`}
                >
                  {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" aria-hidden="true" />}
                  <IconComponent className={`size-[18px] ${active ? "text-accent" : "text-muted group-hover:text-ink"}`} />
                  {item.label}
                  {Boolean(item.badge) && <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">{item.badge! > 99 ? "99+" : item.badge}</span>}
                </Link>
              );
            })}
                </div>
              </div>
            </div>
          </section>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-line p-4">
        <div className="flex items-center gap-3 px-1 pb-3">
          <Avatar name={user.name} src={user.avatarUrl} className="size-10 ring-2 ring-edge" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-muted">{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <form action={logout}>
          <button type="submit" className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50"><LogoutIcon className="size-[18px]" /> Sign out</button>
        </form>
      </div>
    </aside>
  );

  return (
    <div className="min-h-dvh bg-page">
      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-navy/50 backdrop-blur-sm" />
          <div className="relative h-full w-fit shadow-2xl">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-[276px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-edge/80 bg-white/85 px-4 shadow-[0_1px_12px_rgba(24,19,64,.035)] backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDrawer(true)} className="flex size-10 items-center justify-center rounded-lg text-ink hover:bg-page lg:hidden" aria-label="Open menu"><MenuIcon /></button>
            <Link href={home} className="flex items-center gap-2 lg:hidden" aria-label={`${siteName} home`}><BrandMark className="size-8" /></Link>
          </div>
          <div className="flex items-center gap-2">
            {role !== "student" && toGrade > 0 && (
              <Link href="/teach/grading" className="hidden items-center gap-1.5 rounded-full bg-cyan-soft px-3 py-1.5 text-xs font-semibold text-cyan-ink hover:bg-cyan/20 md:flex"><ClipboardIcon className="size-3.5" /> {toGrade} to grade</Link>
            )}
            {xp && <LevelBadge xp={xp} />}
            <NotificationMenu items={notifications} unread={unread} markAllRead={markAllRead} />
            <span className="mx-1 hidden h-6 w-px bg-edge sm:block" />
            <UserMenu user={{ ...user, role }} studentId={studentId} logout={logout} />
          </div>
        </header>

        <main id="main" className="portal-main mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-14 lg:pt-8">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-edge bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(24,19,64,0.08)] backdrop-blur-xl lg:hidden">
        {bottom.map((item) => {
          const active = isActive(pathname, tab, item);
          const IconComponent = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition ${active ? "text-accent" : "text-muted active:scale-95"}`}>
              {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-accent" />}
              <IconComponent className={`size-[22px] transition ${active ? "-translate-y-0.5" : ""}`} />
              {item.label}
              {item.href === "/notifications" && unread > 0 && <span className="absolute right-[calc(50%-18px)] top-1.5 size-2 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
