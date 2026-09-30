import { z } from "zod";
import type { SqlResult } from "@/db/schema";

/** Results larger than this aren't accepted as answers, and are cut short when shown. */
export const SQL_MAX_ROWS = 1000;
/** The most setup SQL a dataset can hold (it's downloaded into the student's browser). */
export const SQL_MAX_SETUP_BYTES = 3_000_000;
export const SQL_MAX_QUERY_CHARS = 20_000;

export const sqlResultSchema = z.object({
  columns: z.array(z.string().max(200)).max(100),
  rows: z.array(z.array(z.string().max(2000).nullable()).max(100)).max(SQL_MAX_ROWS),
});

export const sqlTablesSchema = z.array(z.object({
  name: z.string().max(100),
  rows: z.number().int().min(0),
  columns: z.array(z.object({ name: z.string().max(100), type: z.string().max(60) })).max(200),
})).max(50);

/** Parses a result posted from the browser, or null when it isn't a valid one. */
export function parseSqlResult(raw: unknown): SqlResult | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = sqlResultSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Numbers compare by value (so 12.50 matches 12.5); everything else compares as text. */
function normalise(cell: string | null): string {
  if (cell === null) return "\u0000null";
  const trimmed = cell.trim();
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(trimmed)) return String(Math.round(Number(trimmed) * 1e6) / 1e6);
  return trimmed;
}

/**
 * Whether a student's result matches the expected one: the same number of columns and the same rows.
 * Column names don't matter (aliases vary); row order only matters when the question says so.
 */
export function resultsMatch(expected: SqlResult, got: SqlResult, orderMatters: boolean): boolean {
  if (expected.columns.length !== got.columns.length || expected.rows.length !== got.rows.length) return false;
  const key = (row: (string | null)[]) => JSON.stringify(row.map(normalise));
  const a = expected.rows.map(key);
  const b = got.rows.map(key);
  if (!orderMatters) {
    a.sort();
    b.sort();
  }
  return a.every((row, i) => row === b[i]);
}

// ---------- CSV to SQL ----------

/** Splits CSV text into rows of cells (handles quoted cells with commas, quotes and line breaks). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** A safe SQL name: lower case letters, digits and underscores, not starting with a digit. */
export function sqlName(raw: string, fallback: string): string {
  const name = raw.trim().toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  if (!name) return fallback;
  return /^[0-9]/.test(name) ? `t_${name}` : name;
}

const TYPES: { type: string; test: (v: string) => boolean }[] = [
  { type: "integer", test: (v) => /^-?\d{1,9}$/.test(v) },
  { type: "bigint", test: (v) => /^-?\d{1,18}$/.test(v) },
  { type: "numeric", test: (v) => /^-?(\d+\.?\d*|\.\d+)$/.test(v) },
  { type: "date", test: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) },
  { type: "timestamp", test: (v) => /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v) },
  { type: "boolean", test: (v) => /^(true|false)$/i.test(v) },
];

const quote = (v: string) => `'${v.replace(/'/g, "''")}'`;

/** Turns one CSV file into SQL that creates and fills a table, guessing each column's type from its values. */
export function csvToSql(fileName: string, text: string): { table: string; sql: string; rows: number } {
  const [header, ...body] = parseCsv(text);
  if (!header?.length) throw new Error(`${fileName} is empty.`);
  if (!body.length) throw new Error(`${fileName} has a header row but no data.`);
  const table = sqlName(fileName, "data");
  const seen = new Set<string>();
  const columns = header.map((h, i) => {
    let name = sqlName(h, `column_${i + 1}`);
    while (seen.has(name)) name = `${name}_${i + 1}`;
    seen.add(name);
    const values = body.map((r) => (r[i] ?? "").trim()).filter((v) => v !== "");
    const type = TYPES.find((t) => values.length > 0 && values.every(t.test))?.type ?? "text";
    return { name, type };
  });
  const value = (raw: string | undefined, type: string) => {
    const v = (raw ?? "").trim();
    if (v === "") return "NULL";
    if (["integer", "bigint", "numeric"].includes(type)) return v;
    if (type === "boolean") return v.toLowerCase();
    return quote(v);
  };
  const lines = [`CREATE TABLE "${table}" (${columns.map((c) => `"${c.name}" ${c.type}`).join(", ")});`];
  for (let i = 0; i < body.length; i += 500) {
    const chunk = body.slice(i, i + 500).map((r) => `(${columns.map((c, j) => value(r[j], c.type)).join(", ")})`);
    lines.push(`INSERT INTO "${table}" (${columns.map((c) => `"${c.name}"`).join(", ")}) VALUES\n${chunk.join(",\n")};`);
  }
  return { table, sql: lines.join("\n"), rows: body.length };
}
