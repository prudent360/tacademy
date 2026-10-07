"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { SearchHit } from "@/app/api/search/route";
import { ArrowRight, BookIcon, BriefcaseIcon, CardIcon, ClipboardIcon, LayersIcon, SearchIcon, UserIcon, type Icon } from "@/components/icons";

/** Something the palette can do: open a page, or run an action (switch theme, sign out…). */
export type Command = { id: string; title: string; detail?: string; group: string; icon?: Icon; href?: string; run?: () => void; keywords?: string };

const HIT_ICON: Record<SearchHit["kind"], Icon> = { person: UserIcon, course: BookIcon, cohort: LayersIcon, payment: CardIcon, job: BriefcaseIcon, application: ClipboardIcon };

/** Higher is better; 0 means no match. Every word typed must appear somewhere. */
function score(c: Command, words: string[]): number {
  const title = c.title.toLowerCase();
  const all = `${title} ${c.detail ?? ""} ${c.group} ${c.keywords ?? ""}`.toLowerCase();
  if (!words.every((w) => all.includes(w))) return 0;
  const q = words.join(" ");
  if (title.startsWith(q)) return 4;
  if (title.split(/[\s:›·-]+/).some((w) => w.startsWith(words[0]))) return 3;
  return title.includes(words[0]) ? 2 : 1;
}

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const noop = () => () => {};

/**
 * The ⌘K / Ctrl+K command palette: jump to any page you can open, run quick actions, and search people,
 * courses, payments and more as you type.
 */
export function CommandPalette({ commands }: { commands: Command[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<{ q: string; items: SearchHit[] }>({ q: "", items: [] });
  const mac = useSyncExternalStore(noop, isMac, () => true);

  // ⌘K / Ctrl+K anywhere, and "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) { el.showModal(); input.current?.focus(); }
    if (!open && el.open) el.close();
  }, [open]);

  // Live results from the server, a moment after typing stops.
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (res.ok) setHits({ q, items: ((await res.json()) as { hits: SearchHit[] }).hits });
      } catch {}
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [q]);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const local = words.length
      ? commands.map((c) => ({ c, s: score(c, words) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 12).map((x) => x.c)
      : commands.filter((c) => c.group === "Quick actions" || c.group === "Pages").slice(0, 14);
    const remote: Command[] = q.length >= 2 && hits.q === q ? hits.items.map((h, i) => ({ id: `hit-${i}`, title: h.title, detail: h.detail, group: h.group, icon: HIT_ICON[h.kind], href: h.href })) : [];
    // Group headings in a steady order: what you typed matched first, then live results.
    const ordered = [...local, ...remote];
    const groups: { group: string; items: Command[] }[] = [];
    for (const c of ordered) {
      const g = groups.find((x) => x.group === c.group) ?? (groups.push({ group: c.group, items: [] }), groups[groups.length - 1]);
      g.items.push(c);
    }
    return groups;
  }, [commands, q, hits]);
  const flat = results.flatMap((g) => g.items);
  const searching = q.length >= 2 && hits.q !== q;
  const current = Math.min(active, Math.max(0, flat.length - 1));

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }
  function choose(c: Command | undefined) {
    if (!c) return;
    close();
    if (c.run) c.run();
    else if (c.href) router.push(c.href);
  }
  function move(by: number) {
    if (!flat.length) return;
    const next = (current + by + flat.length) % flat.length;
    setActive(next);
    list.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  }

  let index = -1;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search" aria-keyshortcuts="Meta+K Control+K" className="flex size-10 cursor-pointer items-center justify-center rounded-full text-body hover:bg-page md:h-10 md:w-[300px] md:justify-start md:gap-2.5 md:rounded-[5px] md:border md:border-edge md:bg-page/70 md:px-3 md:text-sm md:text-muted md:hover:border-edge-strong md:hover:bg-page lg:w-[360px]">
        <SearchIcon className="size-[18px] shrink-0" />
        <span className="hidden grow text-left md:inline">Search or jump to…</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-edge bg-surface px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted md:inline-flex">{mac ? "⌘" : "Ctrl"} K</kbd>
      </button>

      <dialog
        ref={dialog}
        aria-label="Search and quick navigation"
        onClose={close}
        onClick={(e) => { if (e.target === dialog.current) close(); }}
        className="mx-auto mb-auto mt-[8vh] w-[min(640px,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-[8px] border border-edge bg-surface p-0 text-ink shadow-[0_40px_120px_-30px_rgba(12,11,18,.6)] backdrop:bg-[#0c0b12]/45 backdrop:backdrop-blur-[2px] sm:mt-[12vh]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon className="size-5 shrink-0 text-muted" />
          <input
            ref={input}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
              else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
              else if (e.key === "Enter") { e.preventDefault(); choose(flat[current]); }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={flat.length ? `command-${current}` : undefined}
            placeholder="Search pages, people, courses, payments…"
            // The page-wide focus outline isn't needed here: the box is the whole dialog and the cursor is in it.
            style={{ outline: "none" }}
            className="h-14 min-w-0 grow border-0 bg-transparent text-[16px] text-ink placeholder:text-muted"
          />
          {searching && <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-edge border-t-accent" aria-label="Searching" />}
          <kbd onClick={close} className="shrink-0 cursor-pointer rounded border border-edge px-1.5 py-0.5 text-[11px] font-semibold text-muted">Esc</kbd>
        </div>
        <div ref={list} id="command-results" role="listbox" className="max-h-[min(60vh,460px)] overflow-y-auto p-2">
          {results.map((g) => (
            <div key={g.group} role="group" aria-label={g.group} className="pb-1">
              <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.group}</p>
              {g.items.map((c) => {
                index++;
                const i = index;
                const ItemIcon = c.icon ?? ArrowRight;
                const on = i === current;
                return (
                  <button
                    key={c.id}
                    id={`command-${i}`}
                    data-index={i}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => { if (!on) setActive(i); }}
                    onClick={() => choose(c)}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-[5px] px-3 py-2.5 text-left ${on ? "bg-accent-soft" : ""}`}
                  >
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-[5px] ${on ? "bg-surface text-accent" : "bg-page text-muted"}`}><ItemIcon className="size-4" /></span>
                    <span className="flex min-w-0 grow flex-col">
                      <span className={`truncate text-[15px] font-semibold ${on ? "text-accent-ink" : "text-ink"}`}>{c.title}</span>
                      {c.detail && <span className="truncate text-[13px] text-muted">{c.detail}</span>}
                    </span>
                    {on && <ArrowRight className="size-4 shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
          ))}
          {!flat.length && (
            <p className="px-3 py-10 text-center text-sm text-muted">{searching ? "Searching…" : q ? <>No results for “{q}”.</> : "Start typing to search."}</p>
          )}
        </div>
        <div className="hidden items-center gap-4 border-t border-line bg-page/60 px-4 py-2.5 text-[12px] text-muted sm:flex">
          <span><kbd className="font-sans font-semibold">↑↓</kbd> to move</span>
          <span><kbd className="font-sans font-semibold">↵</kbd> to open</span>
          <span><kbd className="font-sans font-semibold">Esc</kbd> to close</span>
          <span className="ml-auto">Open anytime with <kbd className="font-sans font-semibold">{mac ? "⌘" : "Ctrl"} K</kbd></span>
        </div>
      </dialog>
    </>
  );
}
