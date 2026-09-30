"use client";

import { useRef, useState } from "react";
import { ActionForm, Input, SubmitButton, Textarea } from "@/components/forms";
import type { SqlTableInfo } from "@/db/schema";
import { csvToSql } from "@/lib/sql";
import type { FormState } from "@/lib/validation";
import { fingerprint, inspectDataset, runSql, type RunOutcome } from "./runner";
import { SqlEditor } from "./sql-editor";
import { runButton, SqlOutput, SqlTables } from "./sql-parts";
import { useRunBeforeSubmit } from "./use-run-before-submit";

type Source = "csv" | "sql";

/** Creates a dataset, or edits one. The data is loaded in the browser to check it works before it's saved. */
export function DatasetForm({ action, dataset, canReplaceData = true, lockedReason }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  dataset?: { name: string; description: string; setupSql: string };
  canReplaceData?: boolean;
  lockedReason?: string;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [replacing, setReplacing] = useState(!dataset);
  const [source, setSource] = useState<Source>("csv");
  const [setupSql, setSetupSql] = useState(dataset?.setupSql ?? "");
  const [files, setFiles] = useState<{ table: string; rows: number }[]>([]);
  const [checked, setChecked] = useState<{ sql: string; tables: SqlTableInfo[] } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tryQuery, setTryQuery] = useState("");
  const [tryOutcome, setTryOutcome] = useState<RunOutcome | null>(null);

  const draft = { key: `draft:${fingerprint(setupSql)}`, setup: async () => setupSql };

  async function check(): Promise<boolean> {
    if (!setupSql.trim()) { setProblem("Add the data first: upload CSV files or paste SQL."); return false; }
    setBusy(true);
    setProblem(null);
    const outcome = await inspectDataset(draft);
    setBusy(false);
    if ("error" in outcome) { setChecked(null); setProblem(`The data didn't load: ${outcome.error}`); return false; }
    if (!outcome.tables.length) { setChecked(null); setProblem("The data loaded, but didn't create any tables."); return false; }
    setChecked({ sql: setupSql, tables: outcome.tables });
    return true;
  }
  useRunBeforeSubmit(anchor, () => replacing && checked?.sql !== setupSql, check);

  async function readFiles(list: FileList | null) {
    if (!list?.length) return;
    setProblem(null);
    try {
      const made = await Promise.all(Array.from(list).map(async (file) => {
        if (file.size > 3_000_000) throw new Error(`${file.name} is larger than 3 MB.`);
        return csvToSql(file.name, await file.text());
      }));
      const names = made.map((m) => m.table);
      const clash = names.find((n, i) => names.indexOf(n) !== i);
      if (clash) throw new Error(`Two files would both become the table “${clash}”. Rename one of them.`);
      setSetupSql(made.map((m) => m.sql).join("\n\n"));
      setFiles(made.map((m) => ({ table: m.table, rows: m.rows })));
      setChecked(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Those files couldn't be read.");
    }
  }

  const tab = (value: Source, label: string) => (
    <button type="button" onClick={() => setSource(value)} aria-pressed={source === value} className={`h-9 cursor-pointer rounded-lg px-3.5 text-sm font-semibold ${source === value ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}>{label}</button>
  );

  return (
    <ActionForm action={action}>
      <div ref={anchor} className="flex flex-col gap-5">
        <Input label="Name" name="name" defaultValue={dataset?.name} required maxLength={120} placeholder="e.g. Retail sales 2025" />
        <Textarea label="Description (optional)" name="description" defaultValue={dataset?.description} rows={2} maxLength={600} hint="What's in it, and what kinds of questions it suits." />

        {!replacing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-edge bg-panel px-4 py-3 text-sm">
            <span className="text-body">{canReplaceData ? "Keeping the current data." : lockedReason}</span>
            {canReplaceData && <button type="button" onClick={() => { setReplacing(true); setSetupSql(""); setChecked(null); }} className="cursor-pointer font-semibold text-accent hover:text-accent-dark">Replace the data</button>}
          </div>
        ) : (
          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold text-ink">Data</legend>
            <div className="flex gap-1">{tab("csv", "Upload CSV files")}{tab("sql", "Paste SQL")}</div>
            {source === "csv" ? (
              <div className="flex flex-col gap-2">
                <input type="file" accept=".csv,text/csv" multiple onChange={(e) => readFiles(e.target.files)} className="w-full min-w-0 text-sm text-body file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent-soft file:px-4 file:font-semibold file:text-accent" />
                <p className="text-[13px] text-muted">One file per table; the file name becomes the table name (orders.csv → orders). The first row must be the column names. Column types are worked out from the values.</p>
                {files.length > 0 && <p className="text-sm text-body">Ready: {files.map((f) => `${f.table} (${f.rows} rows)`).join(", ")}</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea value={setupSql} onChange={(e) => { setSetupSql(e.target.value); setChecked(null); }} rows={10} spellCheck={false} aria-label="SQL that creates and fills the tables" placeholder={"CREATE TABLE sales (id integer, region text, amount numeric);\nINSERT INTO sales VALUES (1, 'North', 120.50), (2, 'South', 98.00);"} className="w-full rounded-[8px] border border-edge-strong bg-white p-3 font-mono text-[13px] text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10" />
                <p className="text-[13px] text-muted">CREATE TABLE and INSERT statements, as many as you need.</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={check} disabled={busy} className={runButton}>{busy ? "Checking…" : "Check the data"}</button>
              {checked?.sql === setupSql && <span className="text-sm font-semibold text-emerald-700">Loaded: {checked.tables.length} table{checked.tables.length === 1 ? "" : "s"}</span>}
            </div>
            {problem && <p role="alert" className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{problem}</p>}
            {checked?.sql === setupSql && (
              <div className="flex flex-col gap-3 rounded-[8px] border border-edge p-4">
                <SqlTables tables={checked.tables} />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Try a query</p>
                <SqlEditor label="Try a query" value={tryQuery} onChange={setTryQuery} tables={checked.tables} minHeight={70} onRun={async () => setTryOutcome(await runSql(draft, tryQuery))} />
                <div><button type="button" onClick={async () => { setBusy(true); setTryOutcome(await runSql(draft, tryQuery)); setBusy(false); }} className={runButton}>Run</button></div>
                <SqlOutput outcome={tryOutcome} running={false} />
              </div>
            )}
            <input type="hidden" name="setupSql" value={setupSql} />
            <input type="hidden" name="tables" value={checked?.sql === setupSql ? JSON.stringify(checked.tables) : ""} />
          </fieldset>
        )}
        <div><SubmitButton pendingText="Saving…">{dataset ? "Save dataset" : "Create dataset"}</SubmitButton></div>
      </div>
    </ActionForm>
  );
}
