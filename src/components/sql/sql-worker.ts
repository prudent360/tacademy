/// <reference lib="webworker" />
// Runs SQL in the browser with PGlite (Postgres compiled to WebAssembly), off the main thread so a slow
// query can be stopped. Each query runs in a transaction that's rolled back, so the data never changes.
import { PGlite } from "@electric-sql/pglite";

const MAX_ROWS = 1000;

type Request = { id: number; key: string; setup: string; sql?: string; inspect?: boolean };

let current: { key: string; db: PGlite } | null = null;

async function dbFor(key: string, setup: string): Promise<PGlite> {
  if (current?.key === key) return current.db;
  await current?.db.close().catch(() => {});
  current = null;
  const db = await PGlite.create();
  await db.exec(setup);
  current = { key, db };
  return db;
}

/** Every value as text, the way it's shown and marked. */
function cell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.replace("T", " ").replace(/\.000Z$|Z$/, "");
  }
  if (typeof value === "bigint" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value.slice(0, 2000);
  if (value instanceof Uint8Array) return `\\x${Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  return JSON.stringify(value).slice(0, 2000);
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, key, setup, sql, inspect } = event.data;
  try {
    const db = await dbFor(key, setup);
    if (inspect) {
      const cols = await db.query<{ table_name: string; column_name: string; data_type: string }>(
        "select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position",
      );
      const names = [...new Set(cols.rows.map((c) => c.table_name))];
      const tables = [];
      for (const name of names) {
        const counted = await db.query<{ n: number }>(`select count(*)::int as n from "${name.replace(/"/g, '""')}"`);
        tables.push({ name, rows: counted.rows[0]?.n ?? 0, columns: cols.rows.filter((c) => c.table_name === name).map((c) => ({ name: c.column_name, type: c.data_type })) });
      }
      self.postMessage({ id, tables });
      return;
    }
    let result: { columns: string[]; rows: (string | null)[][]; total: number } | null = null;
    await db.transaction(async (tx) => {
      const results = await tx.exec(sql ?? "", { rowMode: "array" });
      // The last statement that returns columns is the answer.
      const last = [...results].reverse().find((r) => r.fields.length > 0) ?? results.at(-1);
      const rows = (last?.rows ?? []) as unknown as unknown[][];
      result = { columns: last?.fields.map((f) => f.name) ?? [], rows: rows.slice(0, MAX_ROWS).map((r) => r.map(cell)), total: rows.length };
      await tx.rollback();
    });
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
