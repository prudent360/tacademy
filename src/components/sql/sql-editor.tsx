"use client";

import { useEffect, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { keymap } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { PostgreSQL, sql } from "@codemirror/lang-sql";
import type { SqlTableInfo } from "@/db/schema";

const theme = EditorView.theme({
  "&": { fontSize: "14px", backgroundColor: "#fff" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { fontFamily: "var(--font-mono, ui-monospace, monospace)", padding: "10px 0" },
  ".cm-gutters": { backgroundColor: "#f9f9fd", borderRight: "1px solid #eae9f3", color: "#9593a8" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "#f3f2ff" },
});

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
