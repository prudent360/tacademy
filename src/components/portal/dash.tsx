import Link from "next/link";
import { ArrowRight, type Icon } from "@/components/icons";

const BANNER_TONES = {
  student: "from-[#19112e] via-[#332251] to-[#7134d9]",
  instructor: "from-[#10233a] via-[#183b55] to-[#0a6d8c]",
  admin: "from-[#19112e] via-[#35205d] to-[#7134d9]",
} as const;

/** Role-aware welcome banner at the top of each dashboard. */
export function GreetingBanner({ title, subtitle, children, aside, tone = "student" }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode; aside?: React.ReactNode; tone?: keyof typeof BANNER_TONES }) {
  return (
    <section className={`portal-hero relative overflow-hidden rounded-[5px] bg-gradient-to-br ${BANNER_TONES[tone]} p-6 text-white shadow-[0_24px_70px_-36px_rgba(25,17,46,.75)] md:p-8`}>
      <div aria-hidden="true" className="portal-hero-orb absolute -right-12 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden="true" className="absolute -bottom-32 left-1/3 size-64 rounded-full bg-cyan/10 blur-3xl" />
      <svg aria-hidden="true" viewBox="-22 -1 44 44" className="pointer-events-none absolute -right-10 -top-10 size-64 opacity-[0.07]">
        <g transform="rotate(45)" fill="#fff"><rect x="0" y="2" width="10" height="16.5" /><rect x="11.5" y="0" width="18.5" height="10" /><rect x="0" y="20" width="18.5" height="10" /><rect x="20" y="11.5" width="10" height="16.5" /></g>
      </svg>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-.6px] md:text-[34px]">{title}</h1>
          {subtitle && <div className="text-[15px] text-white/70">{subtitle}</div>}
          {children && <div className="mt-3 flex flex-wrap gap-2.5">{children}</div>}
        </div>
        {aside && <div className="relative shrink-0">{aside}</div>}
      </div>
    </section>
  );
}

export function BannerButton({ href, children, variant = "light" }: { href: string; children: React.ReactNode; variant?: "light" | "ghost" }) {
  return (
    <Link href={href} className={`inline-flex h-10 items-center gap-2 rounded-[5px] px-4 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 ${variant === "light" ? "bg-white text-accent shadow-sm hover:bg-accent-soft hover:shadow-md" : "border border-white/30 bg-white/[.04] text-white hover:border-white/50 hover:bg-white/10"}`}>
      {children}
    </Link>
  );
}

const TILE_TONES = {
  purple: { icon: "bg-accent-soft text-accent", mark: "text-accent-soft" },
  cyan: { icon: "bg-cyan-soft text-cyan-ink", mark: "text-cyan-soft" },
  green: { icon: "bg-emerald-50 text-emerald-700", mark: "text-emerald-50" },
  amber: { icon: "bg-amber-50 text-amber-700", mark: "text-amber-50" },
  red: { icon: "bg-red-50 text-red-700", mark: "text-red-50" },
  navy: { icon: "bg-navy text-white", mark: "text-edge" },
} as const;
export type TileTone = keyof typeof TILE_TONES;

/** Stat card with a coloured icon and a large faded watermark icon. */
export function StatTile({ label, value, icon: IconComponent, tone = "purple", hint, href }: { label: string; value: React.ReactNode; icon: Icon; tone?: TileTone; hint?: React.ReactNode; href?: string }) {
  const t = TILE_TONES[tone];
  const body = (
    <>
      <span aria-hidden="true" className={`pointer-events-none absolute -bottom-4 -right-4 ${t.mark}`}><IconComponent className="size-24" /></span>
      <span className={`relative flex size-12 shrink-0 items-center justify-center rounded-[5px] ${t.icon}`}><IconComponent className="size-6" /></span>
      <span className="relative flex min-w-0 flex-col">
        <span className="font-display text-[26px] font-bold leading-tight tracking-tight text-ink">{value}</span>
        <span className="text-sm text-muted">{label}</span>
        {hint && <span className="mt-0.5 text-xs font-medium text-muted">{hint}</span>}
      </span>
    </>
  );
  const cls = "stat-tile relative flex items-center gap-4 overflow-hidden rounded-[5px] border border-edge bg-white p-5 shadow-[0_1px_2px_rgba(25,17,46,.03)]";
  return href ? <Link href={href} className={`${cls} group transition duration-200 hover:-translate-y-1 hover:border-accent-muted hover:shadow-[0_16px_40px_-24px_rgba(25,17,46,.4)]`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function ProgressBar({ value, max = 100, tone = "purple", label, detail }: { value: number; max?: number; tone?: "purple" | "cyan" | "green" | "amber"; label?: React.ReactNode; detail?: React.ReactNode }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bar = { purple: "bg-accent", cyan: "bg-cyan", green: "bg-emerald-500", amber: "bg-amber-500" }[tone];
  return (
    <div className="flex flex-col gap-1.5">
      {(label || detail) && (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-muted">{label}</span>
          <span className="font-semibold text-ink">{detail ?? `${pct}%`}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-page" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`progress-fill h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function QuickAction({ href, icon: IconComponent, title, text, tone = "purple" }: { href: string; icon: Icon; title: string; text: string; tone?: TileTone }) {
  return (
    <Link href={href} className="group flex items-center gap-4 rounded-[5px] border border-edge bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent-muted hover:bg-accent-soft/35 hover:shadow-[0_12px_30px_-22px_rgba(25,17,46,.45)]">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-[5px] transition duration-200 group-hover:scale-105 ${TILE_TONES[tone].icon}`}><IconComponent className="size-5" /></span>
      <span className="flex min-w-0 grow flex-col">
        <span className="font-semibold text-ink">{title}</span>
        <span className="text-sm text-muted">{text}</span>
      </span>
      <ArrowRight className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  );
}

/** A panel with a title row and optional "View all" link. */
export function Panel({ title, href, linkLabel = "View all", children, className = "", icon: IconComponent, padded = true }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string; icon?: Icon; padded?: boolean }) {
  return (
    <section className={`portal-panel flex flex-col rounded-[5px] border border-edge bg-white shadow-[0_1px_2px_rgba(25,17,46,.025)] ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5 md:px-6 md:pt-6">
        <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-ink">{IconComponent && <IconComponent className="size-[18px] text-accent" />}{title}</h2>
        {href && <Link href={href} className="flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-dark">{linkLabel} <ArrowRight className="size-3.5" /></Link>}
      </div>
      <div className={padded ? "grow p-5 pt-3 md:px-6 md:pb-6" : "grow pt-3"}>{children}</div>
    </section>
  );
}

export function PanelEmpty({ icon: IconComponent, children, action }: { icon: Icon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <IconComponent className="size-10 text-edge-strong" />
      <p className="text-sm text-muted">{children}</p>
      {action}
    </div>
  );
}

/** Minimal server-rendered bar chart. */
export function BarChart({ data, format = (v) => String(v), tone = "purple", height = 180 }: { data: { label: string; value: number }[]; format?: (v: number) => string; tone?: "purple" | "cyan"; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const color = tone === "purple" ? "bg-accent" : "bg-cyan";
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(d.value > 0 ? 4 : 2, Math.round((d.value / max) * (height - 44)));
        const last = i === data.length - 1;
        return (
        <div key={d.label} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className={`truncate text-[11px] font-semibold ${last ? "text-ink" : "text-muted"}`}>{d.value > 0 ? format(d.value) : ""}</span>
            <div className={`chart-bar w-full max-w-12 rounded-t-lg ${d.value > 0 ? color : "bg-page"} ${last ? "" : "opacity-60 group-hover:opacity-100"} transition-all duration-300 group-hover:-translate-y-0.5`} style={{ height: h }} title={`${d.label}: ${format(d.value)}`} />
            <span className="text-[11px] font-medium text-muted">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Date block used in compact lists. */
export function DateChip({ day, month, muted = false }: { day: string; month: string; muted?: boolean }) {
  return (
    <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-[5px] ${muted ? "bg-page text-muted" : "bg-accent-soft text-accent"}`}>
      <span className="font-display text-lg font-bold leading-none">{day}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider">{month}</span>
    </span>
  );
}
