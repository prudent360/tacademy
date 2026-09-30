"use client";

import { useRef, useState } from "react";
import { loadDatasetSetup } from "@/app/actions/sql";
import type { SqlTableInfo } from "@/db/schema";
import { runSql, savedDataset, type RunOutcome } from "./runner";
import { SqlEditor } from "./sql-editor";
import { runButton, SqlOutput, SqlTables } from "./sql-parts";
import { useRunBeforeSubmit } from "./use-run-before-submit";

/**
 * A SQL question in a quiz. The student's query runs in their browser; when the quiz is submitted, the query
 * and its result go to the server, which compares the result with the answer (the answer never reaches the browser).
 */
export function SqlQuestion({ questionId, position, dataset, starter, columns }: { questionId: number; position: number; dataset: { id: number; version: string; tables: SqlTableInfo[] }; starter: string; columns: number }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [sql, setSql] = useState(starter);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [ran, setRan] = useState<{ sql: string; outcome: RunOutcome } | null>(null);
  const source = savedDataset(dataset, loadDatasetSetup);

  async function run(): Promise<boolean> {
    setRunning(true);
    const result = await runSql(source, sql);
    setRunning(false);
    setOutcome(result);
    setRan({ sql, outcome: result });
    // Submitting goes ahead even if the query fails; it just counts as wrong.
    return true;
  }
  // Whatever is in the editor when they submit is what's marked, so run it first if it's changed.
  useRunBeforeSubmit(anchor, () => Boolean(sql.trim()) && ran?.sql !== sql, run);

  const latest = ran && ran.sql === sql && "result" in ran.outcome ? ran.outcome.result : null;
  return (
    <div ref={anchor} className="flex min-w-0 flex-col gap-3">
      <SqlTables tables={dataset.tables} />
      <SqlEditor label={`Your query for question ${position}`} value={sql} onChange={setSql} onRun={run} tables={dataset.tables} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={running} className={runButton}>{running ? "Running…" : "Run query"}</button>
        <span className="text-xs text-muted">Ctrl/Cmd + Enter runs it · your answer should have {columns} column{columns === 1 ? "" : "s"}</span>
        {starter && sql !== starter && <button type="button" onClick={() => setSql(starter)} className="ml-auto cursor-pointer text-xs font-semibold text-muted hover:text-ink">Reset to starter code</button>}
      </div>
      <SqlOutput outcome={outcome} running={running} />
      <input type="hidden" name={`sql-${questionId}`} value={sql} />
      <input type="hidden" name={`result-${questionId}`} value={latest ? JSON.stringify({ columns: latest.columns, rows: latest.rows }) : ""} />
    </div>
  );
}
