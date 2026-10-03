"use client";

import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

type StoredDraft = { value: string; savedAt: number };

/** Drafts live only in this browser; storage can be unavailable (private mode, blocked site data), so every access is guarded. */
function writeDraft(key: string, value: string) {
  try { window.localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() })); } catch { /* storage full or blocked */ }
}
function removeDraft(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* storage blocked */ }
}

/** The draft each field had when its page opened, read once so later typing doesn't re-trigger the prompt. */
const draftsAtOpen = new Map<string, string | null>();
function draftAtOpen(key: string): string | null {
  if (!draftsAtOpen.has(key)) {
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(key); } catch { /* storage blocked */ }
    draftsAtOpen.set(key, raw);
  }
  return draftsAtOpen.get(key) ?? null;
}
const noSubscription = () => () => {};
/** The server trims saved text, so leading/trailing whitespace doesn't count as a change. */
const sameText = (a: string, b: string) => a.trim() === b.trim();

function ago(savedAt: number): string {
  const minutes = Math.round((Date.now() - savedAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * A formatting-toolbar editor that reads and writes Markdown, so it's a drop-in replacement for a
 * Markdown textarea: the value is submitted under `name`, stored as before, and shown with the same
 * renderer. "Draft with AI" fills it through the hidden input (see AiDraftButton).
 *
 * Unsaved changes are backed up in this browser as you type (nothing reaches the server until Save),
 * and offered back if the page is reopened before saving.
 */
export function RichTextEditor({ label, name, defaultValue = "", hint, placeholder, minHeight = 220 }: { label: string; name: string; defaultValue?: string; hint?: React.ReactNode; placeholder?: string; minHeight?: number }) {
  const id = useId();
  const hidden = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [source, setSource] = useState(false);
  /** True once the person has changed the text since it was last saved; only their own edits are backed up. */
  const dirty = useRef(false);
  // The draft's key is per page and field; it only exists in the browser (null while rendering on the server).
  const draftKey = useSyncExternalStore(noSubscription, () => `rte-draft:${window.location.pathname}${window.location.search}:${name}`, () => null);
  const rawDraft = useSyncExternalStore(noSubscription, () => (draftKey ? draftAtOpen(draftKey) : null), () => null);
  const [dismissed, setDismissed] = useState(false);
  const pendingWrite = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draft = useMemo(() => {
    if (!rawDraft || dismissed) return null;
    try {
      const parsed = JSON.parse(rawDraft) as StoredDraft;
      return typeof parsed.value === "string" && parsed.value.trim() && !sameText(parsed.value, defaultValue) && typeof parsed.savedAt === "number" ? parsed : null;
    } catch {
      return null;
    }
  }, [rawDraft, dismissed, defaultValue]);

  const editor = useEditor({
    extensions: [
      // Underline has no Markdown form, so it's left out; headings start at H2 (the page title is H1).
      StarterKit.configure({ underline: false, heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
      Markdown,
    ],
    content: defaultValue,
    contentType: "markdown",
    immediatelyRender: false,
    // The typing area fills the editor's height, so clicking anywhere in the box starts typing.
    editorProps: { attributes: { class: "tiptap-content prose prose-slate dark:prose-invert max-w-none px-4 py-3 focus:outline-none", style: `min-height: ${minHeight}px`, "aria-labelledby": `${id}-label` } },
    // Programmatic changes use emitUpdate: false, so this only runs for the person's own edits.
    onUpdate: ({ editor: e }) => {
      dirty.current = true;
      setValue(e.getMarkdown());
    },
  });

  // React resets a form after its server action succeeds; the editor should then show the newly saved text.
  const latestDefault = useRef(defaultValue);
  useEffect(() => { latestDefault.current = defaultValue; }, [defaultValue]);

  // Text put into the hidden input from outside (AI drafts) or a form reset flows back into the editor.
  useEffect(() => {
    const input = hidden.current;
    if (!input || !editor) return;
    const fromOutside = () => {
      if (input.value !== editor.getMarkdown()) {
        editor.commands.setContent(input.value, { contentType: "markdown", emitUpdate: false });
        dirty.current = true;
        setValue(input.value);
      }
    };
    // Wait a tick so the refreshed page's saved text has arrived before resetting to it.
    const onReset = () => setTimeout(() => {
      editor.commands.setContent(latestDefault.current, { contentType: "markdown", emitUpdate: false });
      dirty.current = false;
      setValue(latestDefault.current);
    }, 0);
    input.addEventListener("input", fromOutside);
    input.form?.addEventListener("reset", onReset);
    return () => {
      input.removeEventListener("input", fromOutside);
      input.form?.removeEventListener("reset", onReset);
    };
  }, [editor]);

  // Forget the page-open snapshot when leaving, so a later visit reads storage afresh.
  useEffect(() => () => { if (draftKey) draftsAtOpen.delete(draftKey); }, [draftKey]);

  // Back up edits as they happen (not while a restore is being offered); once the saved content matches, drop the backup.
  useEffect(() => {
    if (!draftKey || draft) return;
    if (sameText(value, defaultValue)) return removeDraft(draftKey);
    if (!dirty.current) return;
    pendingWrite.current = setTimeout(() => writeDraft(draftKey, value), 600);
    return () => { if (pendingWrite.current) clearTimeout(pendingWrite.current); };
  }, [draftKey, value, defaultValue, draft]);

  // Saving the form clears the backup.
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form || !draftKey) return;
    // Cancel a backup that's about to be written too, or it would reappear right after saving.
    const onSubmit = () => {
      if (pendingWrite.current) clearTimeout(pendingWrite.current);
      dirty.current = false;
      removeDraft(draftKey);
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [editor, draftKey]);

  function restoreDraft() {
    if (!draft) return;
    editor?.commands.setContent(draft.value, { contentType: "markdown", emitUpdate: false });
    dirty.current = true;
    setValue(draft.value);
    setDismissed(true);
  }

  function discardDraft() {
    if (draftKey) removeDraft(draftKey);
    setDismissed(true);
  }

  function toggleSource() {
    if (source && editor) editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    setSource(!source);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-semibold text-ink">{label}</span>
      {draft && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span>You have unsaved changes to this from {ago(draft.savedAt)}.</span>
          <span className="flex gap-2">
            <button type="button" onClick={restoreDraft} className="cursor-pointer rounded-md bg-amber-900 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-950 dark:bg-[#78350f] dark:hover:bg-[#451a03]">Restore</button>
            <button type="button" onClick={discardDraft} className="cursor-pointer rounded-md border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100">Discard</button>
          </span>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-edge-strong bg-surface transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
        <Toolbar editor={editor} source={source} onToggleSource={toggleSource} />
        {source ? (
          <textarea aria-labelledby={`${id}-label`} value={value} onChange={(e) => { dirty.current = true; setValue(e.target.value); }} spellCheck className="block w-full resize-y px-4 py-3 font-mono text-sm text-ink focus:outline-none" style={{ minHeight }} />
        ) : (
          <div style={{ minHeight }}><EditorContent editor={editor} /></div>
        )}
      </div>
      <input ref={hidden} type="hidden" name={name} value={value} />
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

const ICON = "size-4";
const icons = {
  undo: <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></svg>,
  redo: <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 000 11H13" /></svg>,
  bullet: <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>,
  ordered: <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 4h1v4M4 8h2M4 11.5a1 1 0 012 0c0 1-2 1.5-2 2.5h2" strokeWidth="1.5" /></svg>,
  quote: <svg viewBox="0 0 24 24" className={ICON} fill="currentColor"><path d="M7 7h4v4H8.5c0 1.7.8 2.8 2.5 3.2V16c-2.9-.4-4-2.4-4-5.3zm7 0h4v4h-2.5c0 1.7.8 2.8 2.5 3.2V16c-2.9-.4-4-2.4-4-5.3z" /></svg>,
  code: <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /></svg>,
  codeBlock: <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 10l-2 2 2 2M15 10l2 2-2 2" /></svg>,
  rule: <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18" /></svg>,
  link: <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>,
  table: <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16M15 4v16" /></svg>,
};

function Toolbar({ editor, source, onToggleSource }: { editor: Editor | null; source: boolean; onToggleSource: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? {
      block: e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : e.isActive("heading", { level: 4 }) ? "h4" : "p",
      bold: e.isActive("bold"), italic: e.isActive("italic"), strike: e.isActive("strike"), code: e.isActive("code"),
      bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), quote: e.isActive("blockquote"), codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"), table: e.isActive("table"), undo: e.can().undo(), redo: e.can().redo(),
    } : null,
  });
  const off = source || !editor || !state;
  const chain = () => editor!.chain().focus();
  const btn = (active: boolean | undefined) => `flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md px-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-accent-soft text-accent-ink" : "text-body hover:bg-page"}`;
  const sep = <span aria-hidden="true" className="mx-1 h-5 w-px bg-edge" />;

  function editLink() {
    const current = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (leave empty to remove the link)", current ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    // Buttons keep the focus (and selection) in the editor, so typing straight after a click isn't lost.
    <div role="toolbar" aria-label="Formatting" onMouseDown={(e) => { if ((e.target as HTMLElement).closest("button")) e.preventDefault(); }} className="flex flex-wrap items-center gap-0.5 border-b border-line bg-panel px-2 py-1.5">
      <button type="button" title="Undo" aria-label="Undo" disabled={off || !state?.undo} onClick={() => chain().undo().run()} className={btn(false)}>{icons.undo}</button>
      <button type="button" title="Redo" aria-label="Redo" disabled={off || !state?.redo} onClick={() => chain().redo().run()} className={btn(false)}>{icons.redo}</button>
      {sep}
      <select aria-label="Text style" disabled={off} value={state?.block ?? "p"} onChange={(e) => {
        const v = e.target.value;
        if (v === "p") chain().setParagraph().run();
        else chain().setHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 }).run();
      }} className="h-8 cursor-pointer rounded-md border border-edge bg-surface px-2 text-sm text-ink disabled:opacity-40">
        <option value="p">Paragraph</option>
        <option value="h2">Heading</option>
        <option value="h3">Subheading</option>
        <option value="h4">Small heading</option>
      </select>
      {sep}
      <button type="button" title="Bold (Ctrl+B)" aria-label="Bold" aria-pressed={state?.bold} disabled={off} onClick={() => chain().toggleBold().run()} className={btn(state?.bold)}><span className="font-extrabold">B</span></button>
      <button type="button" title="Italic (Ctrl+I)" aria-label="Italic" aria-pressed={state?.italic} disabled={off} onClick={() => chain().toggleItalic().run()} className={btn(state?.italic)}><span className="font-serif italic">I</span></button>
      <button type="button" title="Strikethrough" aria-label="Strikethrough" aria-pressed={state?.strike} disabled={off} onClick={() => chain().toggleStrike().run()} className={btn(state?.strike)}><span className="line-through">S</span></button>
      <button type="button" title="Inline code" aria-label="Inline code" aria-pressed={state?.code} disabled={off} onClick={() => chain().toggleCode().run()} className={btn(state?.code)}>{icons.code}</button>
      <button type="button" title="Link" aria-label="Link" aria-pressed={state?.link} disabled={off} onClick={editLink} className={btn(state?.link)}>{icons.link}</button>
      {sep}
      <button type="button" title="Bulleted list" aria-label="Bulleted list" aria-pressed={state?.bullet} disabled={off} onClick={() => chain().toggleBulletList().run()} className={btn(state?.bullet)}>{icons.bullet}</button>
      <button type="button" title="Numbered list" aria-label="Numbered list" aria-pressed={state?.ordered} disabled={off} onClick={() => chain().toggleOrderedList().run()} className={btn(state?.ordered)}>{icons.ordered}</button>
      <button type="button" title="Quote" aria-label="Quote" aria-pressed={state?.quote} disabled={off} onClick={() => chain().toggleBlockquote().run()} className={btn(state?.quote)}>{icons.quote}</button>
      <button type="button" title="Code block" aria-label="Code block" aria-pressed={state?.codeBlock} disabled={off} onClick={() => chain().toggleCodeBlock().run()} className={btn(state?.codeBlock)}>{icons.codeBlock}</button>
      <button type="button" title="Divider" aria-label="Divider" disabled={off} onClick={() => chain().setHorizontalRule().run()} className={btn(false)}>{icons.rule}</button>
      {sep}
      {state?.table && !source ? (
        <span className="flex items-center gap-0.5 text-xs">
          <button type="button" onClick={() => chain().addRowAfter().run()} className={btn(false)}>+ Row</button>
          <button type="button" onClick={() => chain().addColumnAfter().run()} className={btn(false)}>+ Column</button>
          <button type="button" onClick={() => chain().deleteRow().run()} className={btn(false)}>− Row</button>
          <button type="button" onClick={() => chain().deleteColumn().run()} className={btn(false)}>− Column</button>
          <button type="button" onClick={() => chain().deleteTable().run()} className={`${btn(false)} text-red-700`}>Delete table</button>
        </span>
      ) : (
        <button type="button" title="Insert table" aria-label="Insert table" disabled={off} onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={btn(false)}>{icons.table}</button>
      )}
      <span className="ml-auto" />
      <button type="button" onClick={onToggleSource} aria-pressed={source} className={`${btn(source)} px-2.5 text-xs`} title="Edit the Markdown source">{source ? "Visual editor" : "Markdown"}</button>
    </div>
  );
}
