"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatTurn } from "@/app/actions/ai";
import { SparkIcon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import type { AiResult } from "@/lib/ai";

/** A small chat with the assistant. The conversation lives in the browser; each question sends the recent turns. */
export function AiChat({ send, intro, placeholder = "Ask a question…", suggestions = [] }: { send: (history: ChatTurn[]) => Promise<AiResult>; intro: string; placeholder?: string; suggestions?: string[] }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [turns, busy]);

  async function ask(text: string) {
    const question = text.trim().slice(0, 2000);
    if (!question || busy) return;
    const history: ChatTurn[] = [...turns, { role: "user", content: question }];
    setTurns(history);
    setDraft("");
    setError(null);
    setBusy(true);
    const result = await send(history).catch(() => ({ error: "The assistant is unavailable right now." }));
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      setTurns(turns);
      setDraft(question);
      return;
    }
    setTurns([...history, { role: "assistant", content: result.text }]);
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex max-h-[420px] min-h-40 flex-col gap-3 overflow-y-auto pr-1" aria-live="polite">
        <div className="flex gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-white"><SparkIcon className="size-4" /></span>
          <p className="rounded-[10px] rounded-tl-none bg-panel px-3.5 py-2.5 text-sm text-body">{intro}</p>
        </div>
        {turns.map((turn, i) => turn.role === "user" ? (
          <p key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-[10px] rounded-tr-none bg-accent px-3.5 py-2.5 text-sm text-white">{turn.content}</p>
        ) : (
          <div key={i} className="flex gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-white"><SparkIcon className="size-4" /></span>
            <div className="min-w-0 rounded-[10px] rounded-tl-none bg-panel px-3.5 py-2.5 text-sm [&_.prose]:text-sm"><Markdown>{turn.content}</Markdown></div>
          </div>
        ))}
        {busy && <p className="ml-9 text-sm text-muted">Thinking…</p>}
        <div ref={end} />
      </div>
      {turns.length === 0 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="cursor-pointer rounded-full border border-edge-strong px-3 py-1.5 text-xs font-semibold text-body hover:border-accent hover:text-accent">{s}</button>)}
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); ask(draft); }} className="flex gap-2">
        <label className="sr-only" htmlFor="ai-chat-input">Your question</label>
        <input id="ai-chat-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder={placeholder} autoComplete="off" className="h-11 min-w-0 grow rounded-lg border border-edge-strong bg-white px-3.5 text-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
        <button type="submit" disabled={busy || !draft.trim()} className="h-11 shrink-0 cursor-pointer rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60">Send</button>
      </form>
      <p className="text-[11px] text-muted">AI answers can be wrong. Check anything important.</p>
    </div>
  );
}
