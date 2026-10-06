"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Quick links to each part of a settings page; the part in view is highlighted as you scroll. */
export function SettingsSectionNav({ label, parts }: { label: string; parts: { id: string; label: string }[] }) {
  const [active, setActive] = useState(parts[0]?.id);
  useEffect(() => {
    const sections = parts.map((p) => document.getElementById(p.id)).filter((el): el is HTMLElement => Boolean(el));
    const observer = new IntersectionObserver((entries) => {
      // The topmost section crossing the band under the sticky bar wins.
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-140px 0px -55% 0px" });
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [parts]);
  return (
    <nav aria-label={label} className="sticky top-[72px] z-20 -mt-2 hidden flex-wrap md:flex gap-1.5 rounded-[5px] border border-edge bg-surface/95 p-1.5 shadow-[0_8px_24px_-18px_rgba(24,19,64,.4)] backdrop-blur">
      {parts.map((p) => (
        <a key={p.id} href={`#${p.id}`} onClick={() => setActive(p.id)} aria-current={active === p.id ? "location" : undefined} className={`inline-flex h-9 items-center rounded-[5px] px-3.5 text-sm font-semibold transition ${active === p.id ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-page hover:text-ink"}`}>{p.label}</a>
      ))}
    </nav>
  );
}

/**
 * Phones: one "jump to" menu with every settings page and section, instead of a tab bar that scrolls
 * sideways and a second row of section links.
 */
export function SettingsMobileNav({ groups, current }: { groups: { key: string; label: string; href: string; parts: { id: string; label: string }[] }[]; current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(() => groups.find((g) => g.key === current)?.href ?? "");
  return (
    <label className="relative flex flex-col gap-1.5 md:hidden">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Go to</span>
      <select
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          router.push(e.target.value);
        }}
        className="h-12 w-full cursor-pointer appearance-none rounded-[5px] border border-edge-strong bg-surface pl-3.5 pr-10 text-[15px] font-semibold text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
      >
        {groups.map((g) => g.parts.length > 1 ? (
          <optgroup key={g.key} label={g.label}>
            {g.parts.map((p, i) => <option key={p.id} value={i === 0 ? g.href : `${g.href}#${p.id}`}>{p.label}</option>)}
          </optgroup>
        ) : <option key={g.key} value={g.href}>{g.label}</option>)}
      </select>
      <svg viewBox="0 0 10 6" className="pointer-events-none absolute bottom-[21px] right-4 size-2.5 text-ink" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor" /></svg>
    </label>
  );
}
