"use client";

import { useEffect, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { keymap } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { SqlTableInfo } from "@/db/schema";

// Colours come from the theme tokens (and the --sql-* variables in globals.css), so the editor follows light and dark mode.
const theme = EditorView.theme({
  "&": { fontSize: "14px", backgroundColor: "var(--color-surface)", color: "var(--color-ink)" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { fontFamily: "var(--font-mono, ui-monospace, monospace)", padding: "10px 0", caretColor: "var(--color-ink)" },
  ".cm-cursor": { borderLeftColor: "var(--color-ink)" },
  ".cm-gutters": { backgroundColor: "var(--color-panel)", borderRight: "1px solid var(--color-line)", color: "var(--color-muted)" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--color-accent-soft) 70%, transparent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)" },
  ".cm-tooltip": { backgroundColor: "var(--color-surface)", color: "var(--color-ink)", border: "1px solid var(--color-edge)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--color-accent)", color: "#fff" },
});

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: "var(--sql-keyword)", fontWeight: "600" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--sql-string)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--sql-number)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "var(--color-muted)", fontStyle: "italic" },
  { tag: [tags.typeName, tags.standard(tags.name)], color: "var(--sql-type)" },
  { tag: [tags.function(tags.variableName), tags.special(tags.name)], color: "var(--sql-function)" },
]);

/** A SQL editor with highlighting and table/column suggestions. Ctrl/Cmd+Enter runs the query. */
export function SqlEditor({ value, onChange, onRun, tables, label, minHeight = 140 }: { value: string; onChange: (value: string) => void; onRun?: () => void; tables?: SqlTableInfo[]; label: string; minHeight?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The latest callbacks, so the editor needn't be rebuilt when they change.
  const handlers = useRef({ onChange, onRun });
  useEffect(() => { handlers.current = { onChange, onRun }; });

  const schemaKey = JSON.stringify(tables?.map((t) => [t.name, t.columns.map((c) => c.name)]) ?? []);
  useEffect(() => {
    if (!host.current) return;
    const schema = Object.fromEntries((JSON.parse(schemaKey) as [string, string[]][]));
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: view.current?.state.doc.toString() ?? value,
        extensions: [
          basicSetup,
          EditorView.lineWrapping,
          sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true }),
          Prec.highest(keymap.of([{ key: "Mod-Enter", run: () => { handlers.current.onRun?.(); return true; } }])),
          EditorView.updateListener.of((update) => { if (update.docChanged) handlers.current.onChange(update.state.doc.toString()); }),
          EditorView.contentAttributes.of({ "aria-label": label }),
          theme,
          syntaxHighlighting(highlight),
          EditorView.theme({ ".cm-content, .cm-gutter": { minHeight: `${minHeight}px` } }),
        ],
      }),
    });
    view.current = editor;
    return () => editor.destroy();
    // The document is only seeded once; later changes come from typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaKey, label, minHeight]);

  // Outside changes (like "reset to starter code") replace the text.
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="overflow-hidden rounded-[8px] border border-edge-strong focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10" />;
}
