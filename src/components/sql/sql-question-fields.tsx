"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { loadDatasetSetup } from "@/app/actions/sql";
import { Checkbox } from "@/components/forms";
import type { QuizQuestion, SqlResult, SqlTableInfo } from "@/db/schema";
import { SQL_MAX_ROWS } from "@/lib/sql";
import { runSql, savedDataset, type RunOutcome } from "./runner";
import { SqlEditor } from "./sql-editor";
import { runButton, SqlOutput, SqlTables } from "./sql-parts";
import { useRunBeforeSubmit } from "./use-run-before-submit";

export type DatasetOption = { id: number; name: string; version: string; tables: SqlTableInfo[] };

/** The SQL parts of a quiz question: dataset, starter code and the answer query, whose result becomes the correct answer. */
export function SqlQuestionFields({ question, datasets }: { question?: QuizQuestion; datasets: DatasetOption[] }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [datasetId, setDatasetId] = useState(question?.datasetId ?? datasets[0]?.id ?? 0);
  const [starter, setStarter] = useState(question?.starterSql ?? "");
  const [solution, setSolution] = useState(question?.solutionSql ?? "");
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  // The answer as last worked out, and what it was worked out from; a saved question starts with its stored answer.
  const [answer, setAnswer] = useState<{ sql: string; datasetId: number; result: SqlResult } | null>(
    question?.expected && question.datasetId ? { sql: question.solutionSql, datasetId: question.datasetId, result: question.expected } : null,
  );
  const dataset = datasets.find((d) => d.id === datasetId);
  const current = answer && answer.sql === solution && answer.datasetId === datasetId ? answer : null;

  async function run(): Promise<boolean> {
    if (!dataset) return false;
    setRunning(true);
    const result = await runSql(savedDataset(dataset, loadDatasetSetup), solution);
    setRunning(false);
    setOutcome(result);
    if ("error" in result) return false;
    if (!result.result.columns.length) { setOutcome({ error: "Your answer query needs to end with a SELECT that returns the answer." }); return false; }
    if (result.result.total > SQL_MAX_ROWS) { setOutcome({ error: `The answer returns ${result.result.total} rows. Keep answers to ${SQL_MAX_ROWS} rows or fewer (add a LIMIT or a WHERE).` }); return false; }
    setAnswer({ sql: solution, datasetId, result: { columns: result.result.columns, rows: result.result.rows } });
    return true;
  }
  useRunBeforeSubmit(anchor, () => Boolean(solution.trim()) && !current, run);

  if (!datasets.length) {
    return <p className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">SQL questions need a dataset to query. <Link href="/teach/datasets" className="font-semibold underline">Add one in SQL datasets</Link> first (there are ready-made ones).</p>;
  }

  return (
    <div ref={anchor} className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="sql-dataset" className="text-sm font-semibold text-ink">Dataset</label>
        <select id="sql-dataset" name="datasetId" value={datasetId} onChange={(e) => { setDatasetId(Number(e.target.value)); setOutcome(null); }} className="h-10 rounded-[5px] border border-edge-strong bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10">
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {dataset && <SqlTables tables={dataset.tables} />}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">Starter code <span className="font-normal text-muted">(optional; what students see in the editor to begin with)</span></span>
        <SqlEditor label="Starter code" value={starter} onChange={setStarter} tables={dataset?.tables} minHeight={60} />
        <input type="hidden" name="starterSql" value={starter} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink">Answer query</span>
        <p className="text-[13px] text-muted">Write a query that produces the correct answer and run it. Students are marked right when their query returns the same rows (column names don&apos;t matter). Students never see this query until they pass or run out of attempts.</p>
        <SqlEditor label="Answer query" value={solution} onChange={setSolution} onRun={run} tables={dataset?.tables} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={run} disabled={running} className={runButton}>{running ? "Running…" : "Run answer"}</button>
          <span className="text-xs text-muted">Ctrl/Cmd + Enter also runs it</span>
          {current && <span className="text-sm font-semibold text-emerald-700">Answer set: {current.result.rows.length} row{current.result.rows.length === 1 ? "" : "s"}, {current.result.columns.length} column{current.result.columns.length === 1 ? "" : "s"}</span>}
        </div>
        <SqlOutput outcome={outcome} running={running} />
        <input type="hidden" name="solutionSql" value={solution} />
        <input type="hidden" name="expected" value={current ? JSON.stringify(current.result) : ""} />
      </div>

      <Checkbox label="Row order matters" name="orderMatters" defaultChecked={question?.orderMatters ?? false} hint="Tick when the question asks for a particular order (like “highest first”); otherwise any order is accepted." />
    </div>
  );
}
