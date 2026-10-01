import Link from "next/link";
import type { DeliveryMode, SessionMode } from "@/db/schema";
import { initials, MODE_LABEL } from "@/lib/utils";
import { BuildingIcon, CheckCircleIcon, ClockIcon, MonitorIcon, SearchIcon, SwapIcon, XCircleIcon, type Icon } from "./icons";

export function PageHeader({ title, description, actions, back }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line pb-5">
      {back && (
        <Link href={back.href} className="w-fit text-sm font-semibold text-accent hover:text-accent-dark">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-.7px] text-ink md:text-[36px]">{title}</h1>
          {description && <div className="max-w-[720px] text-[15px] leading-relaxed text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className = "", title, action, padded = true, id }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode; padded?: boolean; id?: string }) {
  return (
    <section id={id} className={`rounded-[5px] border border-edge bg-white shadow-[0_1px_2px_rgba(25,17,46,.025)] ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 md:px-6">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          {action}
        </div>
      )}
      <div className={padded ? "p-5 md:p-6" : ""}>{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "bg-page text-body border-edge",
  accent: "bg-accent-soft text-accent border-transparent",
  green: "bg-emerald-50 text-emerald-800 border-emerald-100",
  amber: "bg-amber-50 text-amber-800 border-amber-100",
  red: "bg-red-50 text-red-800 border-red-100",
  cyan: "bg-cyan-soft text-cyan-ink border-transparent",
  navy: "bg-navy text-white border-transparent",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ children, tone = "neutral", className = "" }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={`inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold ${TONES[tone]} ${className}`}>{children}</span>;
}

const MODE_ICON: Record<DeliveryMode, Icon> = { virtual: MonitorIcon, physical: BuildingIcon, hybrid: SwapIcon };
const MODE_TONE: Record<DeliveryMode, Tone> = { virtual: "accent", physical: "cyan", hybrid: "navy" };

export function ModeBadge({ mode }: { mode: DeliveryMode | SessionMode }) {
  const Icon = MODE_ICON[mode];
  return (
    <Badge tone={MODE_TONE[mode]}>
      <Icon className="size-3.5" /> {MODE_LABEL[mode]}
    </Badge>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  active: "green", paid: "green", graded: "green", present: "green", sent: "green", completed: "accent",
  pending: "amber", submitted: "amber", late: "amber", logged: "neutral",
  failed: "red", cancelled: "red", absent: "red", resubmit: "cyan", refunded: "neutral", excused: "neutral",
};

const STATUS_ICON: Record<string, Icon> = {
  paid: CheckCircleIcon, active: CheckCircleIcon, graded: CheckCircleIcon, sent: CheckCircleIcon, present: CheckCircleIcon, completed: CheckCircleIcon,
  pending: ClockIcon, submitted: ClockIcon, late: ClockIcon,
  failed: XCircleIcon, cancelled: XCircleIcon, absent: XCircleIcon, refunded: XCircleIcon, skipped: XCircleIcon,
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const StatusIcon = STATUS_ICON[status];
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{StatusIcon && <StatusIcon className="size-3.5" />}{label ?? status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
}

export function EmptyState({ title, children, action, icon: IconComponent }: { title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: Icon }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[5px] border border-dashed border-edge-strong bg-panel px-6 py-12 text-center">
      {IconComponent && (
        <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <IconComponent className="size-6" />
        </span>
      )}
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {children && <div className="max-w-[440px] text-[15px] text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: IconComponent }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: Icon }) {
  return (
    <div className="flex flex-col gap-2 rounded-[5px] border border-edge bg-white p-5 shadow-[0_1px_2px_rgba(25,17,46,.025)] transition duration-200 hover:-translate-y-0.5 hover:border-accent-muted hover:shadow-[0_14px_34px_-24px_rgba(25,17,46,.4)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted">{label}</p>
        {IconComponent && <IconComponent className="size-5 text-accent" />}
      </div>
      <p className="font-display text-3xl font-bold tracking-tight text-ink">{value}</p>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

export function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" }[size];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`${dims} shrink-0 rounded-full object-cover`} />;
  }
  return <span aria-hidden="true" className={`${dims} flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-display font-bold text-accent`}>{initials(name)}</span>;
}

export function Tabs({ items, current }: { items: { href: string; label: string; key: string; count?: number; icon?: Icon }[]; current: string }) {
  return (
    <nav aria-label="Sections" className="flex gap-1 overflow-x-auto border-b border-edge">
      {items.map((item) => {
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 text-[15px] font-semibold ${active ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"}`}
          >
            {item.icon && <item.icon className="size-[18px]" />}
            {item.label}
            {item.count !== undefined && <span className="rounded-full bg-page px-2 text-xs text-muted">{item.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Notice({ tone = "green", children }: { tone?: "green" | "amber" | "red" | "accent"; children: React.ReactNode }) {
  const styles = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    accent: "border-accent-muted/40 bg-accent-soft text-navy",
  }[tone];
  return <div role="status" className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles}`}>{children}</div>;
}

export const buttonClass = {
  primary: "inline-flex h-11 items-center justify-center gap-2 rounded-[5px] bg-accent px-5 text-[15px] font-semibold text-white shadow-[0_8px_20px_-12px_rgba(113,52,217,.85)] transition hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-md active:translate-y-0",
  secondary: "inline-flex h-11 items-center justify-center gap-2 rounded-[5px] border border-edge-strong bg-white px-5 text-[15px] font-semibold text-ink transition hover:-translate-y-0.5 hover:border-accent-muted hover:bg-page active:translate-y-0",
  ghost: "inline-flex h-11 items-center justify-center gap-2 rounded-[5px] px-3 text-[15px] font-semibold text-accent transition hover:bg-accent-soft",
  small: "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-edge-strong bg-white px-3 text-sm font-semibold text-ink transition hover:border-accent-muted hover:bg-page",
};

export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[5px] border border-edge bg-white shadow-[0_1px_2px_rgba(25,17,46,.025)]">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm [&_tbody_tr:hover]:bg-accent-soft/25 [&_tbody_tr]:transition-colors [&_td]:border-t [&_td]:border-line [&_td]:px-5 [&_td]:py-4 [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:bg-panel [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[1px] [&_th]:text-muted">
        {children}
      </table>
    </div>
  );
}

/** Avatar with name and email, for the first column of people tables. */
export function PersonCell({ name, email, src, href }: { name: string; email?: string; src?: string | null; href?: string }) {
  const inner = (
    <span className="flex items-center gap-3">
      <Avatar name={name} src={src} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-ink">{name}</span>
        {email && <span className="truncate text-xs text-muted">{email}</span>}
      </span>
    </span>
  );
  return href ? <Link href={href} className="block hover:[&_span.font-semibold]:text-accent">{inner}</Link> : inner;
}

/**
 * Search box and filter pills above a table. Filters are plain links and the search is a GET form,
 * so results are shareable URLs and work without JavaScript.
 */
export function TableToolbar({ action, q, placeholder, hidden = {}, filters, right }: {
  action: string;
  q?: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
  filters?: { label: string; href: string; active: boolean; count?: number }[];
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[5px] border border-edge bg-white p-4 shadow-[0_1px_2px_rgba(25,17,46,.025)] lg:flex-row lg:items-center">
      <form action={action} className="relative flex-1">
        {Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="h-11 w-full rounded-lg border border-edge-strong bg-white pl-10 pr-3 text-sm text-ink placeholder:text-[#8b8598] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
      </form>
      {filters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f) => (
            <Link key={f.label} href={f.href} aria-current={f.active ? "true" : undefined} className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${f.active ? "bg-accent text-white" : "bg-page text-muted hover:bg-edge hover:text-ink"}`}>
              {f.label}
              {f.count !== undefined && <span className={`rounded-full px-1.5 text-[11px] ${f.active ? "bg-white/20" : "bg-white"}`}>{f.count}</span>}
            </Link>
          ))}
        </div>
      )}
      {right}
    </div>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">Page {page} of {pages}</span>
      <span className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className={buttonClass.small}>Previous</Link> : <span className={`${buttonClass.small} opacity-40`}>Previous</span>}
        {page < pages ? <Link href={href(page + 1)} className={buttonClass.small}>Next</Link> : <span className={`${buttonClass.small} opacity-40`}>Next</span>}
      </span>
    </nav>
  );
}
