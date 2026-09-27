import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
const PGLITE_DIR = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

/** Creates a Drizzle client. Local PGlite databases are migrated on open. */
export async function createDb(): Promise<Db> {
  const url = databaseUrl();
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    return drizzlePg(pool, { schema });
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Connect a Neon Postgres database to this Vercel project.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  mkdirSync(PGLITE_DIR, { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  // Both drivers expose the same query builder API for this schema.
  return db as unknown as Db;
}

/** Number of migrations in drizzle/, used to notice new ones during local development. */
export function migrationCount(): number {
  try {
    const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8")) as { entries?: unknown[] };
    return journal.entries?.length ?? 0;
  } catch {
    return 0;
  }
}

/** Applies pending migrations to an already-open local PGlite database. */
export async function migrateLocal(db: Db): Promise<void> {
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: MIGRATIONS_FOLDER });
}

/** Runs pending migrations against whichever database is configured. */
export async function runMigrations(db: Db): Promise<void> {
  if (databaseUrl()) {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  }
  // PGlite databases are migrated inside createDb().
}

export async function closeDb(db: Db): Promise<void> {
  const client = (db as unknown as { $client: { end?: () => Promise<void>; close?: () => Promise<void> } }).$client;
  if (client.end) await client.end();
  else if (client.close) await client.close();
}
