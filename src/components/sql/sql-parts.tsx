"use client";

import type { SqlTableInfo } from "@/db/schema";
import type { RunOutcome } from "./runner";

const SHOWN_ROWS = 100;

/** A query's result as a table, or its error. */
export function SqlOutput({ outcome, running }: { outcome: RunOutcome | null; running: boolean }) {
  if (running) return <p className="rounded-[8px] border border-dashed border-edge-strong px-4 py-3 text-sm text-muted">Running… (the first run loads the database, which can take a few seconds)</p>;
  if (!outcome) return null;
  if ("error" in outcome) return <p role="alert" className="whitespace-pre-wrap rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 font-mono text-[13px] text-red-800">{outcome.error}</p>;
  const { result, ms } = outcome;
  if (!result.columns.length) return <p className="rounded-[8px] border border-edge px-4 py-3 text-sm text-muted">The query ran but didn&apos;t return any columns. End with a SELECT to see results.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-[360px] overflow-auto rounded-[8px] border border-edge">
        <table className="w-full border-collapse text-left font-mono text-[13px]">
          <thead className="sticky top-0 bg-panel">
            <tr>{result.columns.map((c, i) => <th key={i} className="whitespace-nowrap border-b border-edge px-3 py-2 font-semibold text-ink">{c}</th>)}</tr>
          </thead>
          <tbody>
            {result.rows.slice(0, SHOWN_ROWS).map((row, i) => (
              <tr key={i} className="odd:bg-surface even:bg-panel/50">
                {row.map((v, j) => <td key={j} className="whitespace-nowrap border-b border-line px-3 py-1.5 text-body">{v === null ? <span className="text-muted">NULL</span> : v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!result.rows.length && <p className="px-3 py-3 text-sm text-muted">No rows.</p>}
      </div>
      <p className="text-xs text-muted">{result.total} row{result.total === 1 ? "" : "s"}{result.total > SHOWN_ROWS ? `, first ${SHOWN_ROWS} shown` : ""} · {ms} ms</p>
    </div>
  );
}

/** The tables in a dataset, with their columns, so students know what to query. */
export function SqlTables({ tables }: { tables: SqlTableInfo[] }) {
  if (!tables.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Tables</p>
      <div className="flex flex-wrap gap-2">
        {tables.map((t) => (
          <details key={t.name} className="group rounded-[8px] border border-edge bg-surface text-sm open:w-full sm:open:w-auto">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 font-mono font-semibold text-ink">{t.name}<span className="font-sans text-xs font-normal text-muted">{t.rows} rows</span></summary>
            <ul className="border-t border-line px-3 py-2 font-mono text-[12.5px]">
              {t.columns.map((c) => <li key={c.name} className="flex justify-between gap-6 py-0.5"><span className="text-ink">{c.name}</span><span className="text-muted">{c.type}</span></li>)}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}

export const runButton = "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-navy px-3.5 text-sm font-semibold text-white hover:bg-ink disabled:cursor-wait disabled:opacity-60";
