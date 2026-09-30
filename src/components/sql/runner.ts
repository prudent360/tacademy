"use client";

import type { SqlTableInfo } from "@/db/schema";

export type RunResult = { columns: string[]; rows: (string | null)[][]; total: number };
export type RunOutcome = { result: RunResult; ms: number } | { error: string };

/** A dataset to query: `key` changes whenever its data does, so the browser knows to reload it. */
export type DatasetSource = { key: string; setup: () => Promise<string> };

const QUERY_TIMEOUT_MS = 10_000;
// The first run also downloads the database engine and loads the data.
const FIRST_RUN_TIMEOUT_MS = 90_000;

let worker: Worker | null = null;
let readyKey: string | null = null;
let nextId = 1;
const pending = new Map<number, (data: { result?: RunResult; tables?: SqlTableInfo[]; error?: string }) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./sql-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event) => {
      pending.get(event.data.id)?.(event.data);
      pending.delete(event.data.id);
    };
  }
  return worker;
}

/** Stops a runaway query by throwing the whole worker away; the next run starts a fresh one. */
function reset() {
  worker?.terminate();
  worker = null;
  readyKey = null;
  for (const resolve of pending.values()) resolve({ error: "Stopped." });
  pending.clear();
}

async function send(source: DatasetSource, message: { sql?: string; inspect?: boolean }) {
  const setup = await source.setup();
  const id = nextId++;
  const timeout = readyKey === source.key ? QUERY_TIMEOUT_MS : FIRST_RUN_TIMEOUT_MS;
  return new Promise<{ result?: RunResult; tables?: SqlTableInfo[]; error?: string }>((resolve) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reset();
      resolve({ error: `The query took longer than ${Math.round(timeout / 1000)} seconds, so it was stopped. Check for a missing join condition or an endless loop.` });
    }, timeout);
    pending.set(id, (data) => {
      window.clearTimeout(timer);
      if (!data.error) readyKey = source.key;
      resolve(data);
    });
    getWorker().postMessage({ id, key: source.key, setup, ...message });
  });
}

/** Runs a query against a dataset in the browser. Changes to the data are always rolled back. */
export async function runSql(source: DatasetSource, sql: string): Promise<RunOutcome> {
  if (!sql.trim()) return { error: "Write a query first." };
  const started = performance.now();
  try {
    const data = await send(source, { sql });
    if (data.error || !data.result) return { error: data.error ?? "The query didn't return anything." };
    return { result: data.result, ms: Math.round(performance.now() - started) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The query couldn't run." };
  }
}

/** Loads a dataset and lists its tables, columns and row counts. */
export async function inspectDataset(source: DatasetSource): Promise<{ tables: SqlTableInfo[] } | { error: string }> {
  try {
    const data = await send(source, { inspect: true });
    return data.error || !data.tables ? { error: data.error ?? "The data couldn't be loaded." } : { tables: data.tables };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The data couldn't be loaded." };
  }
}

/** A short, stable fingerprint of some text, for keying unsaved datasets. */
export function fingerprint(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${text.length}-${(hash >>> 0).toString(36)}`;
}

const setups = new Map<number, Promise<string>>();

/** A saved dataset, fetched from the server once per page. */
export function savedDataset(dataset: { id: number; version: string }, load: (id: number) => Promise<string>): DatasetSource {
  return {
    key: `${dataset.id}:${dataset.version}`,
    setup: () => {
      if (!setups.has(dataset.id)) setups.set(dataset.id, load(dataset.id).catch((error) => { setups.delete(dataset.id); throw error; }));
      return setups.get(dataset.id)!;
    },
  };
}
