import { Fragment } from "react";

/** **bold** inside a line. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
}

/**
 * Plain text written in the admin, shown as paragraphs. Lines starting with "- " become a bullet list and
 * **text** is bold. Nothing else is interpreted, so it's safe to show as-is.
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`flex flex-col gap-4 text-[16px] leading-relaxed text-body ${className}`}>
      {blocks.flatMap((block, i) => {
        // Within a paragraph, consecutive "- " lines become a list; other lines stay as text.
        const runs: { list: boolean; lines: string[] }[] = [];
        for (const line of block.split("\n")) {
          const list = /^\s*[-•*]\s+/.test(line);
          const last = runs[runs.length - 1];
          if (last && last.list === list) last.lines.push(line);
          else runs.push({ list, lines: [line] });
        }
        return runs.map((run, k) => run.list
          ? <ul key={`${i}-${k}`} className="flex flex-col gap-2 pl-1">{run.lines.map((l, j) => <li key={j} className="flex gap-3"><span aria-hidden="true" className="mt-[11px] size-1.5 shrink-0 rounded-full bg-accent" />{inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>)}</ul>
          : <p key={`${i}-${k}`}>{run.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>);
      })}
    </div>
  );
}
