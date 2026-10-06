"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AvatarArt, type Gender } from "@/components/avatar-art";
import { BrandMark } from "@/components/brand-mark";
import { AwardIcon, TrendIcon, BellIcon, MoonIcon, MonitorIcon, SunIcon, BookIcon, BriefcaseIcon, CalendarIcon, CardIcon, MessageIcon, ShieldIcon, ChartIcon, ChevronDown, ChevronRight, ClipboardIcon, CogIcon, DatabaseIcon, DownloadIcon, ExternalIcon, GiftIcon, GridIcon, IdCardIcon, LayersIcon, LogoutIcon, MenuIcon, UserIcon, UsersIcon, VideoIcon, XIcon, type Icon } from "@/components/icons";
import type { Role } from "@/db/schema";
import type { Permission } from "@/lib/permissions";

/** A link, or (with children) a dropdown whose first child is its main page. `href` may carry a ?tab= query. */
/** `perm`: the permission needed to see it (admin-area items only). */
type NavItem = { href: string; label: string; icon: Icon; exact?: boolean; badge?: number; also?: string[]; children?: NavItem[]; perm?: Permission };
type NavGroup = { label: string; items: NavItem[] };
export type ShellNotification = { id: number; title: string; body: string; href: string | null; read: boolean; when: string };

const ROLE_LABEL: Record<Role, string> = { admin: "Administrator", instructor: "Instructor", student: "Student", staff: "Team member" };

const SETTINGS_TABS: [string, string][] = [
  ["general", "General"], ["branding", "Branding"], ["payments", "Payments"], ["email", "Email"], ["templates", "Email templates"],
  ["reminders", "Reminders"], ["whatsapp", "WhatsApp"], ["referrals", "Referrals"], ["announcement", "Dashboard pop-up"], ["seo", "SEO"], ["video", "Video"], ["ai", "AI"],
];

function navFor(role: Role, counts: { unread: number; toGrade: number; newApplications: number; newInstructorApplications: number; newJobApplications?: number }, perms: Permission[], referrals = false): NavGroup[] {
  const learning: NavGroup = {
    label: "Learning",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: GridIcon, exact: true },
      { href: "/dashboard/schedule", label: "Timetable", icon: CalendarIcon },
      { href: "/dashboard/assignments", label: "Assignments", icon: ClipboardIcon },
      { href: "/dashboard/certificates", label: "Certificates", icon: AwardIcon },
      { href: "/dashboard/showcase", label: "Showcase", icon: TrendIcon },
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
      { href: "/admin", label: "Dashboard", icon: GridIcon, exact: true, perm: "admin.access" },
      { href: "/admin/insights", label: "Insights", icon: ChartIcon, perm: "insights.view" },
      { href: "/admin/reports", label: "Reports", icon: TrendIcon, perm: "reports.view" },
    ],
  };
  const programmes: NavGroup = {
    label: "Programmes",
    items: [
      { href: "/admin/courses", label: "Courses & cohorts", icon: BookIcon, also: ["/admin/cohorts", "/teach/cohorts", "/admin/modules", "/admin/lessons"], perm: "courses.manage" },
      {
        href: "/admin/internships", label: "Internships", icon: BriefcaseIcon, children: [
          { href: "/admin/internships", label: "Programmes", icon: BriefcaseIcon, perm: "courses.manage" },
          { href: "/admin/applications", label: "Applications", icon: ClipboardIcon, badge: counts.newApplications, perm: "applications.review" },
        ],
      },
      { href: "/admin/certificates", label: "Certificates", icon: AwardIcon, perm: "certificates.manage" },
      { href: "/admin/reviews", label: "Reviews", icon: MessageIcon, perm: "reviews.manage" },
      { href: "/admin/showcase", label: "Project showcase", icon: AwardIcon, perm: "showcase.manage" },
    ],
  };
  const peopleAndSales: NavGroup = {
    label: "People & sales",
    items: [
      {
        href: "/admin/users", label: "People", icon: UsersIcon, children: [
          { href: "/admin/users", label: "Everyone", icon: UsersIcon, perm: "users.view" },
          { href: "/admin/instructor-applications", label: "Instructor applications", icon: ClipboardIcon, badge: counts.newInstructorApplications, perm: "instructors.review" },
        ],
      },
      {
        href: "/admin/payments", label: "Payments", icon: CardIcon, children: [
          { href: "/admin/payments", label: "All payments", icon: CardIcon, perm: "payments.view" },
          { href: "/admin/discounts", label: "Discount codes", icon: CardIcon, perm: "discounts.manage" },
          { href: "/admin/referrals", label: "Referrals", icon: GiftIcon, perm: "referrals.manage" },
        ],
      },
      { href: "/admin/leads", label: "Curriculum requests", icon: DownloadIcon, perm: "leads.view" },
      { href: "/admin/free-classes", label: "Free classes", icon: VideoIcon, perm: "free_classes.manage" },
      {
        href: "/admin/careers", label: "Careers", icon: BriefcaseIcon, children: [
          { href: "/admin/careers", label: "Job openings", icon: BriefcaseIcon, exact: true, also: ["/admin/careers/new"], perm: "careers.manage" },
          { href: "/admin/careers/applications", label: "Applications", icon: ClipboardIcon, badge: counts.newJobApplications, perm: "careers.manage" },
        ],
      },
    ],
  };
  const system: NavGroup = {
    label: "System",
    items: [
      { href: "/admin/team", label: "Team & roles", icon: ShieldIcon, perm: "team.manage" },
      { href: "/admin/audit", label: "Audit log", icon: ClipboardIcon, perm: "audit.view" },
      {
        href: "/admin/settings", label: "Settings", icon: CogIcon,
        children: SETTINGS_TABS.map(([tab, label]) => ({ href: tab === "general" ? "/admin/settings" : `/admin/settings?tab=${tab}`, label, icon: CogIcon, perm: tab === "templates" ? "emails.manage" as const : "settings.manage" as const, ...(tab === "templates" ? { also: ["/admin/emails"] } : {}) })),
      },
    ],
  };
  const account: NavGroup = {
    label: "Account",
    items: [
      ...(role === "student" ? [{ href: "/dashboard/payments", label: "Payments", icon: CardIcon }] : []),
      ...(referrals ? [{ href: "/account/referrals", label: "Refer & earn", icon: GiftIcon }] : []),
      { href: "/notifications", label: "Notifications", icon: BellIcon, badge: counts.unread },
      { href: "/account", label: "Profile & security", icon: UserIcon, exact: true },
    ],
  };
  if (role === "instructor") return [teaching, account];
  if (role === "student") return [learning, account];
  // Admins and staff see what their permissions allow; a parent with one allowed child keeps just that child.
  const allowed = new Set(perms);
  const keep = (items: NavItem[]): NavItem[] => items.flatMap((item) => {
    if (item.children) {
      const children = keep(item.children);
      return children.length ? [{ ...item, href: children[0].href, children }] : [];
    }
    return !item.perm || allowed.has(item.perm) ? [item] : [];
  });
  const groups = [overview, programmes, peopleAndSales, ...(role === "admin" ? [teaching] : []), system].map((g) => ({ ...g, items: keep(g.items) })).filter((g) => g.items.length > 0);
  return [...groups, account];
}

function bottomNavFor(role: Role, perms: Permission[]): NavItem[] {
  if (role === "admin" || role === "staff") {
    const items: NavItem[] = [
      { href: "/admin", label: "Home", icon: GridIcon, exact: true, perm: "admin.access" },
      { href: "/admin/courses", label: "Courses", icon: BookIcon, perm: "courses.manage" },
      { href: "/admin/payments", label: "Payments", icon: CardIcon, perm: "payments.view" },
      { href: "/admin/users", label: "People", icon: UsersIcon, perm: "users.view" },
    ];
    return [...items.filter((i) => !i.perm || perms.includes(i.perm)), { href: "/account", label: "Account", icon: UserIcon }];
  }
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

function Avatar({ name, src, gender, className = "size-9" }: { name: string; src: string | null; gender?: Gender | null; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
  return <AvatarArt seed={name} gender={gender} className={`${className} shrink-0 rounded-full`} />;
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
        {unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-surface">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-edge bg-surface shadow-[0_24px_48px_-16px_rgba(24,19,64,0.3)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display font-bold text-ink">Notifications</p>
            {unread > 0 && <button type="button" onClick={async () => { await markAllRead(); }} className="cursor-pointer text-xs font-semibold text-accent-ink hover:text-accent-ink-strong">Mark all read</button>}
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
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-accent-ink hover:bg-panel">View all notifications</Link>
        </div>
      )}
    </div>
  );
}

/** Just the person's photo in the top bar; the menu holds their details and account links. */
function UserMenu({ user, studentId, logout }: { user: { name: string; email: string; avatarUrl: string | null; gender?: Gender | null; role: Role }; studentId?: string; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={`Account menu for ${user.name}`} title={user.name} className="flex cursor-pointer rounded-full ring-2 ring-transparent ring-offset-2 transition hover:ring-accent-muted aria-expanded:ring-accent">
        <Avatar name={user.name} src={user.avatarUrl} gender={user.gender} className="size-9" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-[14px] border border-edge bg-surface p-1.5 shadow-[0_24px_48px_-16px_rgba(24,19,64,0.3)]">
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
        <span className="font-display text-[13px] font-extrabold text-accent-ink">{xp.level}</span>
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
      className="flex cursor-pointer items-center gap-2 rounded-full border border-accent-muted/60 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm transition hover:border-accent"
      aria-label={`Student ID ${id}. Copy`}
    >
      <IdCardIcon className="size-4" />
      <span className="text-accent-ink/70">Student ID</span>
      <span className="font-mono tracking-wide">{copied ? "Copied" : id}</span>
    </button>
  );
}

/** Sidebar colours. They follow the theme tokens, so the same classes work in light and dark mode. */
const SIDEBAR = {
    aside: "border-r border-edge bg-surface text-ink shadow-[12px_0_40px_-36px_rgba(24,19,64,.35)]",
    wordmark: "text-ink", wordmarkAccent: "text-accent-ink",
    close: "text-muted hover:bg-panel hover:text-ink",
    collapse: "border-edge bg-surface text-muted hover:text-accent-ink",
    group: "text-muted/80 hover:bg-panel hover:text-ink", groupActive: "text-accent-ink",
    divider: "border-line",
    item: "text-body hover:bg-accent-soft/70 hover:text-accent-ink", itemIcon: "text-muted group-hover:text-accent-ink",
    active: "bg-accent text-white shadow-[0_12px_24px_-14px_rgba(79,63,215,.9)]", activeIcon: "bg-white/20 text-white",
    railItem: "text-muted hover:bg-accent-soft hover:text-accent-ink", railDot: "bg-accent ring-surface",
    parentActive: "text-accent-ink", parentActiveIcon: "bg-accent-soft text-accent-ink",
    sub: "text-muted hover:bg-panel hover:text-ink", subActive: "bg-accent-soft font-semibold text-accent-ink",
    subLine: "border-line", dot: "bg-edge-strong", dotActive: "bg-accent",
    badge: "bg-accent text-white", activeBadge: "bg-surface text-accent-ink",
    promo: "border border-line bg-gradient-to-br from-accent-soft to-panel text-ink",
    support: "bg-accent text-white shadow-[0_12px_24px_-14px_rgba(79,63,215,.9)] hover:bg-accent-dark",
    themeRow: "bg-page text-body",
  };

export type Theme = "light" | "dark" | "system";
const THEME_COOKIE = "tk-theme";
const THEME_CLASS: Record<Theme, string> = { light: "", dark: "theme-dark", system: "theme-system" };
function saveTheme(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}
const THEMES: { value: Theme; label: string; icon: Icon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

/** The little stack of course cards in the sidebar's promo card. */
function PromoArt() {
  return (
    <svg viewBox="0 0 120 96" aria-hidden="true" className="pointer-events-none absolute -bottom-1 -right-2 w-[128px] transition duration-300 group-hover:-translate-y-1">
      <ellipse cx="66" cy="88" rx="44" ry="6" fill="#4f3fd7" opacity=".08" />
      <g transform="rotate(-8 70 50)">
        <rect x="34" y="26" width="64" height="48" rx="8" fill="#a69ef0" />
        <rect x="28" y="20" width="64" height="48" rx="8" fill="#fff" stroke="#dfdeeb" />
        <rect x="28" y="20" width="64" height="16" rx="8" fill="#4f3fd7" />
        <rect x="36" y="44" width="34" height="4" rx="2" fill="#d3d1e2" />
        <rect x="36" y="52" width="24" height="4" rx="2" fill="#e6e5ef" />
        <rect x="36" y="60" width="44" height="3" rx="1.5" fill="#edecfb" />
        <rect x="36" y="60" width="28" height="3" rx="1.5" fill="#31c4f0" />
      </g>
      <path d="M86 6l2.4 5.6L94 14l-5.6 2.4L86 22l-2.4-5.6L78 14l5.6-2.4z" fill="#31c4f0" />
      <circle cx="104" cy="30" r="4" fill="#6e61e3" />
      <circle cx="20" cy="40" r="3" fill="#8fdff7" />
    </svg>
  );
}

export function PortalShell({ children, role, user, siteName, logoUrl, logoDarkUrl = null, theme: initialTheme = "light", unread, toGrade, newApplications = 0, newInstructorApplications = 0, newJobApplications = 0, permissions = [], referrals = false, notifications, studentId, xp, logout, markAllRead }: {
  children: React.ReactNode;
  role: Role;
  user: { name: string; email: string; avatarUrl: string | null; gender?: Gender | null };
  siteName: string;
  logoUrl: string | null;
  /** Shown instead of `logoUrl` in dark mode (Settings → "Logo for dark backgrounds"). */
  logoDarkUrl?: string | null;
  /** The saved theme from the `tk-theme` cookie. */
  theme?: Theme;
  unread: number;
  toGrade: number;
  /** Admins: internship applications waiting for review. */
  newApplications?: number;
  newInstructorApplications?: number;
  newJobApplications?: number;
  /** Admin-area permissions, for admins and staff. */
  permissions?: Permission[];
  /** Refer & earn is switched on. */
  referrals?: boolean;
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
  const groups = navFor(role, { unread, toGrade, newApplications, newInstructorApplications, newJobApplications }, permissions, referrals);
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
  const bottom = bottomNavFor(role, permissions);
  const home = role === "admin" || role === "staff" ? "/admin" : role === "instructor" ? "/teach" : "/dashboard";
  const [first, ...rest] = siteName.split(" ");

  const collapsed = isOpen("rail:collapsed", false);
  const t = SIDEBAR;
  // Remembered per device in a cookie, so the server renders the right theme first time (no flash).
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  function setTheme(next: Theme) {
    setThemeState(next);
    saveTheme(next);
  }

  const sidebar = (compact: boolean) => (
    <aside className={`relative flex h-full flex-col transition-[width,background-color] duration-300 ${compact ? "w-[88px]" : "w-[276px]"} ${t.aside}`}>
      <div className={`flex h-20 shrink-0 items-center ${compact ? "justify-center" : "justify-between pl-6 pr-4"}`}>
        <Link href={home} className="flex items-center gap-2.5" onClick={() => setDrawer(false)} aria-label={compact ? `${siteName} home` : undefined}>
          {compact ? (
            <><BrandMark className="size-9 dark:hidden" /><BrandMark className="hidden size-9 dark:block" tone="reversed" /></>
          ) : logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={siteName} className={`h-11 w-auto max-w-[200px] object-contain ${logoDarkUrl ? "dark:hidden" : "dark:rounded-lg dark:bg-white dark:px-2 dark:py-1"}`} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoDarkUrl && <img src={logoDarkUrl} alt="" aria-hidden="true" className="hidden h-11 w-auto max-w-[200px] object-contain dark:block" />}
            </>
          ) : (
            <>
              <BrandMark className="size-8 dark:hidden" /><BrandMark className="hidden size-8 dark:block" tone="reversed" />
              <span className={`font-display text-lg font-extrabold tracking-[-0.4px] ${t.wordmark}`}>{first}{rest.length > 0 && <span className={`ml-1 font-semibold ${t.wordmarkAccent}`}>{rest.join(" ")}</span>}</span>
            </>
          )}
        </Link>
        <button type="button" onClick={() => setDrawer(false)} className={`flex size-9 items-center justify-center rounded-lg lg:hidden ${t.close}`} aria-label="Close menu"><XIcon /></button>
      </div>
      <button
        type="button"
        onClick={() => toggleNav("rail:collapsed", collapsed)}
        aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
        title={compact ? "Expand sidebar" : "Collapse sidebar"}
        className={`absolute -right-3.5 top-[26px] z-10 hidden size-7 cursor-pointer items-center justify-center rounded-full border shadow-[0_6px_16px_-6px_rgba(24,19,64,.35)] transition hover:scale-110 lg:flex ${t.collapse}`}
      >
        <ChevronRight className={`size-4 transition-transform duration-300 ${compact ? "" : "rotate-180"}`} />
      </button>
      <nav aria-label="Portal" className={`portal-nav-scroll flex grow flex-col overflow-y-auto pb-4 pt-2 ${compact ? "items-center gap-3 px-3" : "gap-2 px-4"}`}>
        {groups.map((group, index) => {
          const containsActive = group.items.some((item) => isActive(pathname, tab, item));
          const open = compact || isOpen(`group:${group.label}`, true);
          const groupCount = group.items.reduce((total, item) => total + (item.badge ?? 0) + (item.children ?? []).reduce((sum, child) => sum + (child.badge ?? 0), 0), 0);
          const groupId = `portal-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`;
          return (
          <section key={group.label} className={compact ? `flex w-full flex-col items-center gap-1.5 ${index > 0 ? `border-t pt-3 ${t.divider}` : ""}` : ""}>
            {!compact && groups.length > 1 && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={groupId}
                onClick={() => toggleNav(`group:${group.label}`, open)}
                className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[1.6px] transition ${containsActive ? t.groupActive : t.group}`}
              >
                <span className="grow">{group.label}</span>
                {groupCount > 0 && <span className={`flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] tracking-normal ${t.badge}`}>{groupCount > 99 ? "99+" : groupCount}</span>}
                <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`} />
              </button>
            )}
            <div id={groupId} className={compact ? "contents" : `sidebar-group-grid ${open ? "is-open" : ""}`}>
              <div className={compact ? "contents" : "min-h-0"}>
                <div className={compact ? "contents" : "flex flex-col gap-1 pb-1 pt-0.5"}>
            {group.items.map((item) => {
              const active = isActive(pathname, tab, item);
              const IconComponent = item.icon;
              const badge = (item.badge ?? 0) + (item.children ?? []).reduce((sum, child) => sum + (child.badge ?? 0), 0);
              // In the slim rail every item is one icon; a dropdown goes to its first page.
              if (compact) {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={item.label}
                    aria-label={badge ? `${item.label} (${badge})` : item.label}
                    aria-current={active && !item.children ? "page" : undefined}
                    className={`relative flex size-12 shrink-0 items-center justify-center rounded-xl transition duration-200 ${active ? t.active : t.railItem}`}
                  >
                    <IconComponent className="size-[22px]" />
                    {badge > 0 && <span className={`absolute right-2 top-2 size-2 rounded-full ring-2 ${active ? "bg-surface ring-accent" : t.railDot}`} />}
                  </Link>
                );
              }
              if (item.children) {
                const itemKey = `item:${item.label}`;
                const expanded = isOpen(itemKey, active);
                const listId = `portal-sub-${item.label.toLowerCase().replace(/\s+/g, "-")}`;
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={listId}
                      onClick={() => toggleNav(itemKey, expanded)}
                      className={`group relative flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl pl-1.5 pr-3 text-left text-sm font-medium transition duration-200 ${active ? t.parentActive : t.item}`}
                    >
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${active ? t.parentActiveIcon : t.itemIcon}`}><IconComponent className="size-[18px]" /></span>
                      <span className="grow">{item.label}</span>
                      {!expanded && badge > 0 && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${t.badge}`}>{badge > 99 ? "99+" : badge}</span>}
                      <ChevronDown className={`size-4 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`} />
                    </button>
                    <div id={listId} className={`sidebar-group-grid ${expanded ? "is-open" : ""}`}>
                      <div className="min-h-0">
                        <div className={`ml-[22px] flex flex-col gap-0.5 border-l py-1 pl-3 ${t.subLine}`}>
                          {item.children.map((child) => {
                            const childActive = isActive(pathname, tab, child);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setDrawer(false)}
                                aria-current={childActive ? "page" : undefined}
                                className={`flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition ${childActive ? t.subActive : t.sub}`}
                              >
                                <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${childActive ? t.dotActive : t.dot}`} />
                                {child.label}
                                {Boolean(child.badge) && <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${t.badge}`}>{child.badge! > 99 ? "99+" : child.badge}</span>}
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
                  className={`group relative flex h-11 items-center gap-2.5 rounded-xl pl-1.5 pr-3 text-sm transition duration-200 ${active ? `font-semibold ${t.active}` : `font-medium ${t.item}`}`}
                >
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition ${active ? t.activeIcon : t.itemIcon}`}><IconComponent className="size-[18px]" /></span>
                  {item.label}
                  {Boolean(item.badge) && <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? t.activeBadge : t.badge}`}>{item.badge! > 99 ? "99+" : item.badge}</span>}
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
      <div className={`flex shrink-0 flex-col gap-4 ${compact ? "items-center px-3 pb-6 pt-2" : "px-4 pb-5 pt-2"}`}>
        {role === "student" && !compact && (
          <Link href="/courses" onClick={() => setDrawer(false)} className={`group relative block min-h-[150px] overflow-hidden rounded-2xl p-4 transition hover:-translate-y-0.5 ${t.promo}`}>
            <p className="relative z-[1] max-w-[150px] text-[15px] leading-snug">Keep growing with a <span className="font-bold text-accent-ink">new course</span> this term!</p>
            <span className="relative z-[1] mt-3 flex size-8 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_16px_-8px_rgba(79,63,215,.9)] transition group-hover:translate-x-1"><ChevronRight className="size-4" /></span>
            <PromoArt />
          </Link>
        )}
        <Link
          href="/contact"
          onClick={() => setDrawer(false)}
          title={compact ? "Support" : undefined}
          aria-label={compact ? "Support" : undefined}
          className={`flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${compact ? "size-12" : "mx-auto h-11 px-7"} ${t.support}`}
        >
          <MessageIcon className="size-5" />
          {!compact && "Support"}
        </Link>
        {compact ? (
          <button
            type="button"
            onClick={() => setTheme(THEMES[(THEMES.findIndex((o) => o.value === theme) + 1) % THEMES.length].value)}
            title={`Theme: ${THEMES.find((o) => o.value === theme)!.label}. Click to change.`}
            aria-label={`Theme: ${THEMES.find((o) => o.value === theme)!.label}. Click to change.`}
            className={`flex size-12 cursor-pointer items-center justify-center rounded-xl transition hover:text-accent-ink ${t.themeRow}`}
          >
            {(() => { const I = THEMES.find((o) => o.value === theme)!.icon; return <I className="size-5" />; })()}
          </button>
        ) : (
          <div role="radiogroup" aria-label="Theme" className={`grid w-full grid-cols-3 gap-1 rounded-xl p-1 ${t.themeRow}`}>
            {THEMES.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={theme === o.value}
                onClick={() => setTheme(o.value)}
                className={`flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition ${theme === o.value ? "bg-surface text-accent-ink shadow-[0_2px_8px_-3px_rgba(24,19,64,.35)]" : "text-muted hover:text-ink"}`}
              >
                <o.icon className="size-4" />{o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className={`min-h-dvh bg-page ${THEME_CLASS[theme]}`}>
      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar(collapsed)}</div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-navy/50 backdrop-blur-sm" />
          <div className="relative h-full w-fit shadow-2xl">{sidebar(false)}</div>
        </div>
      )}

      <div className={`transition-[padding] duration-300 ${collapsed ? "lg:pl-[88px]" : "lg:pl-[276px]"}`}>
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-edge/80 bg-surface/85 px-4 shadow-[0_1px_12px_rgba(24,19,64,.035)] backdrop-blur-xl sm:px-6 lg:px-8">
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
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-edge bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(24,19,64,0.08)] backdrop-blur-xl lg:hidden">
        {bottom.map((item) => {
          const active = isActive(pathname, tab, item);
          const IconComponent = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition ${active ? "text-accent-ink" : "text-muted active:scale-95"}`}>
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
