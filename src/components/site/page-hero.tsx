import type { ReactNode } from "react";
import type { Icon } from "@/components/icons";

/**
 * The hero at the top of the site's inner pages: deep ink with purple and cyan light, a fading dot grid and the
 * outline of the brand mark drifting at the edge. Text rises in on load. It sits under the floating header.
 */

export type HeroFact = { icon: Icon; label: string; value: ReactNode };

/** Buttons for use on the dark hero. */
export const heroButton = {
  primary: "group inline-flex h-12 items-center gap-2 rounded-[5px] bg-white px-6 font-semibold text-ink shadow-[0_18px_40px_-18px_rgba(255,255,255,.55)] transition hover:-translate-y-0.5 hover:bg-[#f1efff]",
  secondary: "inline-flex h-12 items-center gap-2 rounded-[5px] px-6 font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10",
};

/** Key words in a hero title, picked out in the cyan-to-lavender brand light. */
export function HeroHighlight({ children }: { children: ReactNode }) {
  return <span className="bg-[linear-gradient(100deg,#8fdff7_0%,#bcb5f7_55%,#e1def8_100%)] bg-clip-text text-transparent">{children}</span>;
}

function Rise({ delay, className = "", children }: { delay: number; className?: string; children: ReactNode }) {
  return <div className={`hero-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</div>;
}

/** The four blocks of the brand mark, drawn as outlines: white on dark heroes, purple on light ones. */
export function MarkMotif({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const line = tone === "dark" ? "rgba(255,255,255,.16)" : "rgba(79,63,215,.16)";
  return (
    <svg viewBox="-22 -1 44 44" aria-hidden="true" className={className}>
      <g transform="rotate(45)" fill="none" strokeWidth="0.35">
        <rect x="0" y="2" width="10" height="16.5" rx="0.6" stroke={line} />
        <rect x="11.5" y="0" width="18.5" height="10" rx="0.6" stroke={line} />
        <rect x="0" y="20" width="18.5" height="10" rx="0.6" stroke={line} />
        <rect x="20" y="11.5" width="10" height="16.5" rx="0.6" stroke="rgba(49,196,240,.55)" fill="rgba(49,196,240,.08)" />
      </g>
    </svg>
  );
}

export function PageHero({ eyebrow, breadcrumb, title, lead, actions, facts, aside, photo, center = false, children }: {
  eyebrow?: ReactNode;
  /** Shown above the eyebrow, e.g. "Courses › Data Engineering". */
  breadcrumb?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  /** A row of short facts under the text, e.g. duration and format. */
  facts?: HeroFact[];
  /** A visual on the right on large screens, e.g. a HeroVisual. */
  aside?: ReactNode;
  /** A photo behind everything, darkened so the text stays readable. */
  photo?: string | null;
  center?: boolean;
  /** Anything else under the actions (a price, a search note…). */
  children?: ReactNode;
}) {
  return (
    <section data-under-header className="relative isolate overflow-hidden bg-[#120f33] text-white">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" fetchPriority="high" className="size-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,15,51,.95)_0%,rgba(18,15,51,.82)_45%,rgba(18,15,51,.45)_100%)]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_88%_-8%,rgba(79,63,215,.62),transparent_62%),radial-gradient(700px_420px_at_-8%_108%,rgba(49,196,240,.24),transparent_60%),linear-gradient(180deg,#181340_0%,#120f33_100%)]" />
        )}
        {/* A fine dot grid, strongest top right and fading out towards the text. */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,.13)_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_80%_at_85%_20%,#000_10%,transparent_70%)]" />
        <MarkMotif className="hero-motif absolute -right-24 -top-10 size-[520px] opacity-80 max-md:hidden" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(49,196,240,.7)_30%,rgba(124,112,240,.7)_70%,transparent)]" />
      </div>

      <div className={`mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-16 pt-14 sm:px-8 md:pb-20 md:pt-20 ${aside ? "lg:grid-cols-[1.12fr_.88fr] lg:gap-14" : ""}`}>
        <div className={`flex min-w-0 flex-col gap-5 ${center ? "items-center text-center" : ""}`}>
          {breadcrumb && <Rise delay={0} className="text-sm text-white/65">{breadcrumb}</Rise>}
          {eyebrow && (
            <Rise delay={40}>
              <span className="inline-flex items-center gap-2.5 rounded-[5px] bg-white/[.07] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[1.6px] text-cyan-light ring-1 ring-white/15 md:text-xs">
                <span className="hero-dot size-1.5 rounded-full bg-cyan" />{eyebrow}
              </span>
            </Rise>
          )}
          <Rise delay={120}>
            <h1 className={`font-display text-[40px] font-extrabold leading-[1.06] tracking-[-1.4px] sm:text-5xl lg:text-[60px] ${center ? "mx-auto max-w-[820px]" : "max-w-[760px]"}`}>{title}</h1>
          </Rise>
          {lead && <Rise delay={200}><p className={`text-lg leading-relaxed text-white/75 ${center ? "mx-auto max-w-[640px]" : "max-w-[600px]"}`}>{lead}</p></Rise>}
          {children && <Rise delay={260}>{children}</Rise>}
          {actions && <Rise delay={300} className={`flex flex-wrap gap-3 pt-1 ${center ? "justify-center" : ""}`}>{actions}</Rise>}
          {facts && facts.length > 0 && (
            <Rise delay={380} className={`grid w-full grid-cols-2 gap-2.5 pt-3 ${!aside && facts.length > 2 ? "lg:grid-cols-4" : ""}`}>
              {facts.map(({ icon: FactIcon, label, value }) => (
                <div key={label} className="flex items-center gap-3 rounded-[5px] bg-white/[.06] px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm sm:px-4 sm:py-3">
                  <span className="hidden size-9 shrink-0 items-center justify-center rounded-[5px] bg-white/[.08] text-cyan-light sm:flex"><FactIcon className="size-[18px]" /></span>
                  <span className="min-w-0 text-left"><span className="block text-xs text-white/55">{label}</span><span className="block text-[15px] font-semibold leading-snug text-white">{value}</span></span>
                </div>
              ))}
            </Rise>
          )}
        </div>
        {aside && <Rise delay={220} className="min-w-0">{aside}</Rise>}
      </div>
    </section>
  );
}

/** A picture in a frosted frame for the hero's right side, with optional floating notes. */
export function HeroVisual({ children, notes = [] }: { children: ReactNode; notes?: { icon: Icon; title: string; text?: string }[] }) {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="absolute -inset-6 -z-10 rounded-full bg-accent/30 blur-3xl" aria-hidden="true" />
      <div className="rounded-[5px] bg-white/[.07] p-2 ring-1 ring-white/15 shadow-[0_40px_90px_-35px_rgba(0,0,0,.75)] backdrop-blur">
        <div className="overflow-hidden rounded-[3px]">{children}</div>
      </div>
      {notes.map(({ icon: NoteIcon, title, text }, i) => (
        <div
          key={title}
          className={`showcase-bob absolute flex items-center gap-2.5 rounded-[5px] bg-white px-3.5 py-2.5 text-ink shadow-[0_18px_40px_-16px_rgba(0,0,0,.5)] max-sm:hidden ${i % 2 === 0 ? "-left-6 bottom-8" : "-right-4 top-6"}`}
          style={{ animationDelay: `${600 + i * 400}ms` }}
        >
          <span className="flex size-8 items-center justify-center rounded-[5px] bg-accent-soft text-accent"><NoteIcon className="size-4" /></span>
          <span className="flex flex-col"><span className="text-[13px] font-bold leading-tight">{title}</span>{text && <span className="text-xs text-muted">{text}</span>}</span>
        </div>
      ))}
    </div>
  );
}
