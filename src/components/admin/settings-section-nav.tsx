"use client";

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
    <nav aria-label={label} className="sticky top-[72px] z-20 -mt-2 flex flex-wrap gap-1.5 rounded-[5px] border border-edge bg-surface/95 p-1.5 shadow-[0_8px_24px_-18px_rgba(24,19,64,.4)] backdrop-blur">
      {parts.map((p) => (
        <a key={p.id} href={`#${p.id}`} onClick={() => setActive(p.id)} aria-current={active === p.id ? "location" : undefined} className={`inline-flex h-9 items-center rounded-[5px] px-3.5 text-sm font-semibold transition ${active === p.id ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-page hover:text-ink"}`}>{p.label}</a>
      ))}
    </nav>
  );
}
