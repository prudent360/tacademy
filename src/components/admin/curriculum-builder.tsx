"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addLesson, addModule, removeLesson, removeModule, reorderCurriculum, saveModuleDetails, setLessonPublished } from "@/app/actions/learning";
import { ClipboardIcon, EditIcon, FileIcon, PlayIcon, PlusIcon, XIcon } from "@/components/icons";
import type { BuilderLesson, BuilderModule } from "@/lib/curriculum";

type Drag = { type: "lesson"; lessonId: number } | { type: "module"; moduleId: number };
type Target = { type: "lesson"; moduleId: number; index: number } | { type: "module"; index: number };

const KIND = {
  video: { icon: PlayIcon, label: "Video lesson", tone: "bg-accent-soft text-accent" },
  reading: { icon: FileIcon, label: "Reading lesson", tone: "bg-cyan/10 text-[#0e7fa3]" },
  quiz: { icon: ClipboardIcon, label: "Quiz", tone: "bg-amber-50 text-amber-700" },
} as const;

const GripIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4"><g fill="currentColor"><circle cx="5.5" cy="3.5" r="1.3" /><circle cx="10.5" cy="3.5" r="1.3" /><circle cx="5.5" cy="8" r="1.3" /><circle cx="10.5" cy="8" r="1.3" /><circle cx="5.5" cy="12.5" r="1.3" /><circle cx="10.5" cy="12.5" r="1.3" /></g></svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Arrow = ({ up }: { up?: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-3.5 ${up ? "rotate-180" : ""}`}><path d="M8 3v10M4 9l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const iconButton = "flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-panel hover:text-ink disabled:pointer-events-none disabled:opacity-30";

/**
 * The course's modules and lessons on one screen: add, rename, reorder (drag or arrows), publish and delete
 * without leaving the page. Lessons open in their own editor for content, video and quiz questions.
 */
export function CurriculumBuilder({ courseId, modules: initial, lessonHref, canDelete }: {
  courseId: number;
  modules: BuilderModule[];
  /** The editor link for a lesson, e.g. "/admin/lessons/{id}". */
  lessonHref: string;
  /** Deleting is for admins only. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const [modules, setModules] = useState(initial);
  // Fresh data from the server (after a save elsewhere) replaces the local copy.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setModules(initial);
  }
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const drag = useRef<Drag | null>(null);
  const armed = useRef(false);
  const [target, setTarget] = useState<Target | null>(null);
  const href = (id: number) => lessonHref.replace("{id}", String(id));

  function run(action: () => Promise<{ ok: true; id?: number } | { error: string }>, onOk?: (id?: number) => void, rollback?: BuilderModule[]) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        if (rollback) setModules(rollback);
      } else onOk?.(result.id);
    });
  }

  function saveOrder(next: BuilderModule[]) {
    const before = modules;
    setModules(next);
    run(() => reorderCurriculum(courseId, next.map((m) => ({ id: m.id, lessons: m.lessons.map((l) => l.id) }))), undefined, before);
  }

  function moveLesson(lessonId: number, toModule: number, toIndex: number) {
    const lesson = modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
    if (!lesson) return;
    const from = modules.find((m) => m.lessons.some((l) => l.id === lessonId))!;
    const oldIndex = from.lessons.findIndex((l) => l.id === lessonId);
    // Dropping below itself in the same module shifts the index by the gap it leaves.
    const index = from.id === toModule && oldIndex < toIndex ? toIndex - 1 : toIndex;
    if (from.id === toModule && index === oldIndex) return;
    const without = modules.map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }));
    saveOrder(without.map((m) => (m.id === toModule ? { ...m, lessons: [...m.lessons.slice(0, index), lesson, ...m.lessons.slice(index)] } : m)));
  }

  function moveModule(moduleId: number, toIndex: number) {
    const oldIndex = modules.findIndex((m) => m.id === moduleId);
    const index = oldIndex < toIndex ? toIndex - 1 : toIndex;
    if (index === oldIndex) return;
    const next = modules.filter((m) => m.id !== moduleId);
    next.splice(index, 0, modules[oldIndex]);
    saveOrder(next);
  }

  function drop() {
    const d = drag.current;
    if (d && target?.type === "lesson" && d.type === "lesson") moveLesson(d.lessonId, target.moduleId, target.index);
    if (d && target?.type === "module" && d.type === "module") moveModule(d.moduleId, target.index);
    drag.current = null;
    setTarget(null);
  }

  /** Starts a drag only from the grip, so text can still be selected and links clicked. */
  const dragProps = (start: Drag) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      if (!armed.current) return e.preventDefault();
      e.stopPropagation();
      drag.current = start;
      e.dataTransfer.effectAllowed = "move";
    },
    onDragEnd: () => { armed.current = false; drag.current = null; setTarget(null); },
  });
  const grip = (label: string) => (
    <span aria-label={label} title="Drag to reorder" onPointerDown={() => { armed.current = true; }} onPointerUp={() => { armed.current = false; }} className="hidden cursor-grab touch-none text-muted/70 hover:text-ink active:cursor-grabbing sm:flex">
      <GripIcon />
    </span>
  );
  const dropLine = <div aria-hidden="true" className="h-0.5 rounded-full bg-accent" />;

  return (
    <div className="flex flex-col gap-3" onDragOver={(e) => { if (drag.current) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); drop(); }}>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      {!modules.length && <p className="rounded-xl border border-dashed border-edge-strong p-6 text-center text-sm text-muted">No modules yet. Add the first one below, such as “Week 1: Getting started”, then add lessons and quizzes to it.</p>}

      {modules.map((module, mi) => {
        const open = !collapsed.has(module.id);
        const published = module.lessons.filter((l) => l.published).length;
        return (
          <div key={module.id} className="flex flex-col gap-3">
            {target?.type === "module" && target.index === mi && dropLine}
            <section
              {...dragProps({ type: "module", moduleId: module.id })}
              onDragOver={(e) => {
                if (drag.current?.type === "module") { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setTarget({ type: "module", index: e.clientY < r.top + r.height / 2 ? mi : mi + 1 }); }
              }}
              className="overflow-hidden rounded-xl border border-edge bg-white"
            >
              <ModuleHeader
                module={module}
                open={open}
                grip={grip(`Reorder ${module.title}`)}
                summary={`${module.lessons.length} item${module.lessons.length === 1 ? "" : "s"}${module.lessons.length ? ` · ${published ? `${published} published` : "all drafts"}` : ""}`}
                onToggle={() => setCollapsed((c) => { const n = new Set(c); if (n.has(module.id)) n.delete(module.id); else n.add(module.id); return n; })}
                onSave={(title, summary, done) => run(() => saveModuleDetails(module.id, title, summary), () => { setModules((ms) => ms.map((m) => (m.id === module.id ? { ...m, title, summary } : m))); done(); })}
                onMove={(dir) => moveModule(module.id, dir < 0 ? mi - 1 : mi + 2)}
                first={mi === 0}
                last={mi === modules.length - 1}
                onDelete={canDelete ? () => {
                  if (!window.confirm(`Delete “${module.title}” and its ${module.lessons.length} lesson${module.lessons.length === 1 ? "" : "s"}? Students' progress in them is lost.`)) return;
                  const before = modules;
                  setModules(modules.filter((m) => m.id !== module.id));
                  run(() => removeModule(module.id), undefined, before);
                } : undefined}
              />
              {open && (
                <div
                  className="flex flex-col border-t border-line px-2 py-2 sm:px-3"
                  // Rows handle their own spot; anywhere else in the list (or an empty module) means "at the end".
                  onDragOver={(e) => { if (drag.current?.type === "lesson") { e.preventDefault(); setTarget({ type: "lesson", moduleId: module.id, index: module.lessons.length }); } }}
                >
                  {module.lessons.map((lesson, li) => (
                    <div key={lesson.id}>
                      {target?.type === "lesson" && target.moduleId === module.id && target.index === li && dropLine}
                      <LessonRow
                        lesson={lesson}
                        href={href(lesson.id)}
                        grip={grip(`Reorder ${lesson.title}`)}
                        dragProps={dragProps({ type: "lesson", lessonId: lesson.id })}
                        onDragOver={(e) => {
                          if (drag.current?.type !== "lesson") return;
                          e.preventDefault();
                          e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          setTarget({ type: "lesson", moduleId: module.id, index: e.clientY < r.top + r.height / 2 ? li : li + 1 });
                        }}
                        // Arrows move within the module, then on into the next or previous one.
                        onMove={(dir) => {
                          if (dir < 0) return li > 0 ? moveLesson(lesson.id, module.id, li - 1) : moveLesson(lesson.id, modules[mi - 1].id, modules[mi - 1].lessons.length);
                          return li < module.lessons.length - 1 ? moveLesson(lesson.id, module.id, li + 2) : moveLesson(lesson.id, modules[mi + 1].id, 0);
                        }}
                        canUp={li > 0 || mi > 0}
                        canDown={li < module.lessons.length - 1 || mi < modules.length - 1}
                        onPublish={() => {
                          const before = modules;
                          setModules(modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => (l.id === lesson.id ? { ...l, published: !l.published } : l)) })));
                          run(() => setLessonPublished(lesson.id, !lesson.published), undefined, before);
                        }}
                        onDelete={canDelete ? () => {
                          if (!window.confirm(`Delete “${lesson.title}”? Students' progress and quiz attempts for it are lost.`)) return;
                          const before = modules;
                          setModules(modules.map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== lesson.id) })));
                          run(() => removeLesson(lesson.id), undefined, before);
                        } : undefined}
                      />
                    </div>
                  ))}
                  {target?.type === "lesson" && target.moduleId === module.id && target.index === module.lessons.length && dropLine}
                  {!module.lessons.length && <p className="px-3 py-2 text-sm text-muted">Nothing in this module yet. Drag a lesson here or add one.</p>}
                  <AddItems
                    pending={pending}
                    onAdd={(title, kind, done) => run(() => addLesson(module.id, title, kind), (id) => {
                      done();
                      // A quiz needs questions, so it opens straight away; a lesson can be filled in later.
                      if (kind === "quiz" && id) router.push(`${href(id)}#quiz`);
                    })}
                  />
                </div>
              )}
            </section>
          </div>
        );
      })}
      {target?.type === "module" && target.index === modules.length && dropLine}

      <InlineAdd
        label="Add module"
        placeholder="Module title, e.g. Week 2: Cleaning data"
        pending={pending}
        className="rounded-xl border border-dashed border-edge-strong bg-white/60 p-3"
        onAdd={(title, done) => run(() => addModule(courseId, title), done)}
        startOpen={!modules.length}
      />
      <p className="text-xs text-muted">Students see a lesson once it&apos;s published (and its module&apos;s release date for their cohort has passed). Drag the handles or use the arrows to reorder; lessons can move between modules.</p>
    </div>
  );
}

function ModuleHeader({ module, open, grip, summary, onToggle, onSave, onMove, first, last, onDelete }: {
  module: BuilderModule;
  open: boolean;
  grip: React.ReactNode;
  summary: string;
  onToggle: () => void;
  onSave: (title: string, summary: string, done: () => void) => void;
  onMove: (dir: -1 | 1) => void;
  first: boolean;
  last: boolean;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <form
        className="flex flex-col gap-3 bg-panel p-4"
        onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave(String(f.get("title")), String(f.get("summary")), () => setEditing(false)); }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">Module title
          <input name="title" defaultValue={module.title} required maxLength={160} autoFocus className="h-10 rounded-lg border border-edge-strong bg-white px-3 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">Summary <span className="font-normal text-muted">(optional, shown to students and on the course page)</span>
          <textarea name="summary" defaultValue={module.summary} maxLength={500} rows={2} className="rounded-lg border border-edge-strong bg-white px-3 py-2 font-normal focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink">Cancel</button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-2 bg-panel/70 px-3 py-2.5 sm:px-4">
      {grip}
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 grow items-center gap-2 py-1 text-left">
        <span className="text-muted"><Chevron open={open} /></span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-display text-[15px] font-bold text-ink">{module.title}</span>
          <span className="truncate text-xs text-muted">{summary}</span>
        </span>
      </button>
      <span className="flex shrink-0 items-center">
        <button type="button" onClick={() => onMove(-1)} disabled={first} className={iconButton} aria-label={`Move ${module.title} up`}><Arrow up /></button>
        <button type="button" onClick={() => onMove(1)} disabled={last} className={iconButton} aria-label={`Move ${module.title} down`}><Arrow /></button>
        <button type="button" onClick={() => setEditing(true)} className={iconButton} aria-label={`Rename ${module.title}`} title="Rename"><EditIcon className="size-4" /></button>
        {onDelete && <button type="button" onClick={onDelete} className={`${iconButton} hover:text-red-600`} aria-label={`Delete ${module.title}`} title="Delete module"><XIcon className="size-4" /></button>}
      </span>
    </div>
  );
}

function LessonRow({ lesson, href, grip, dragProps, onDragOver, onMove, canUp, canDown, onPublish, onDelete }: {
  lesson: BuilderLesson;
  href: string;
  grip: React.ReactNode;
  dragProps: React.HTMLAttributes<HTMLDivElement> & { draggable: boolean };
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onMove: (dir: -1 | 1) => void;
  canUp: boolean;
  canDown: boolean;
  onPublish: () => void;
  onDelete?: () => void;
}) {
  const kind = KIND[lesson.kind];
  const Icon = kind.icon;
  return (
    <div {...dragProps} onDragOver={onDragOver} className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-panel sm:gap-3 sm:px-2">
      {grip}
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${kind.tone}`} title={kind.label}><Icon className="size-4" /><span className="sr-only">{kind.label}</span></span>
      <Link href={href} className="flex min-w-0 grow flex-col">
        <span className="truncate text-[15px] font-semibold text-ink group-hover:text-accent">{lesson.title}</span>
        <span className="truncate text-xs text-muted">
          {lesson.kind === "quiz" ? "Quiz" : lesson.kind === "video" ? "Video" : "Reading"} · {lesson.minutes} min
          {lesson.quizQuestions !== null && (lesson.quizQuestions ? ` · Quiz, ${lesson.quizQuestions} question${lesson.quizQuestions === 1 ? "" : "s"}` : " · Quiz has no questions yet")}
        </span>
      </Link>
      <button
        type="button"
        onClick={onPublish}
        aria-pressed={lesson.published}
        title={lesson.published ? "Students can see this. Click to make it a draft." : "Only staff can see this. Click to publish."}
        className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition ${lesson.published ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-page text-muted ring-1 ring-edge hover:text-ink"}`}
      >
        <span className={`size-1.5 rounded-full ${lesson.published ? "bg-emerald-500" : "bg-muted/60"}`} />
        {lesson.published ? "Published" : "Draft"}
      </button>
      <span className="flex shrink-0 items-center">
        <button type="button" onClick={() => onMove(-1)} disabled={!canUp} className={iconButton} aria-label={`Move ${lesson.title} up`}><Arrow up /></button>
        <button type="button" onClick={() => onMove(1)} disabled={!canDown} className={iconButton} aria-label={`Move ${lesson.title} down`}><Arrow /></button>
        <Link href={href} className={`${iconButton} hidden sm:flex`} aria-label={`Edit ${lesson.title}`} title="Edit"><EditIcon className="size-4" /></Link>
        {onDelete && <button type="button" onClick={onDelete} className={`${iconButton} hover:text-red-600`} aria-label={`Delete ${lesson.title}`} title="Delete"><XIcon className="size-4" /></button>}
      </span>
    </div>
  );
}

/** "+ Lesson" and "+ Quiz" at the foot of a module. */
function AddItems({ pending, onAdd }: { pending: boolean; onAdd: (title: string, kind: "lesson" | "quiz", done: () => void) => void }) {
  const [adding, setAdding] = useState<"lesson" | "quiz" | null>(null);
  if (adding) {
    return (
      <InlineAdd
        label={adding === "quiz" ? "Add quiz" : "Add lesson"}
        placeholder={adding === "quiz" ? "Quiz title, e.g. Week 1 check-in" : "Lesson title, e.g. Importing data from Excel"}
        pending={pending}
        startOpen
        className="mt-1 px-1"
        // Stays open after adding, so several lessons can be typed in a row; a quiz opens its editor instead.
        onAdd={(title, done) => onAdd(title, adding, done)}
        onCancel={() => setAdding(null)}
      />
    );
  }
  return (
    <div className="mt-1 flex flex-wrap gap-2 px-1 pb-1">
      <button type="button" onClick={() => setAdding("lesson")} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft"><PlusIcon className="size-4" /> Lesson</button>
      <button type="button" onClick={() => setAdding("quiz")} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft"><PlusIcon className="size-4" /> Quiz</button>
    </div>
  );
}

function InlineAdd({ label, placeholder, pending, onAdd, onCancel, startOpen = false, className = "" }: {
  label: string;
  placeholder: string;
  pending: boolean;
  onAdd: (title: string, done: () => void) => void;
  onCancel?: () => void;
  startOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(startOpen);
  const [title, setTitle] = useState("");
  if (!open) {
    return (
      <div className={className}>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft"><PlusIcon className="size-4" /> {label}</button>
      </div>
    );
  }
  return (
    <form
      className={`flex flex-wrap items-center gap-2 ${className}`}
      onSubmit={(e) => { e.preventDefault(); if (title.trim()) onAdd(title.trim(), () => setTitle("")); }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { setOpen(startOpen && !onCancel); onCancel?.(); } }}
        placeholder={placeholder}
        aria-label={label}
        maxLength={160}
        autoFocus={!startOpen || Boolean(onCancel)}
        className="h-10 min-w-0 grow rounded-lg border border-edge-strong bg-white px-3 text-[15px] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10"
      />
      <button type="submit" disabled={pending || !title.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"><PlusIcon className="size-4" /> {label}</button>
      {onCancel && <button type="button" onClick={onCancel} className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink">Cancel</button>}
    </form>
  );
}
