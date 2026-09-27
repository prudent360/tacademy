import "server-only";
import { createDb, databaseUrl, migrateLocal, migrationCount, type Db } from "./client";

const globalForDb = globalThis as unknown as {
  __db?: Promise<Db>;
  /** Migration count the local database was last brought up to, and the run in progress. */
  __dbMigrated?: { count: number; run: Promise<void> };
};

/**
 * Shared database handle. Uses Postgres when DATABASE_URL is set (Vercel/Neon),
 * otherwise an embedded PGlite database under .data/ for local development.
 *
 * The dev server keeps this handle across code reloads, so locally it also applies
 * migrations added while the server is running. Production migrates at build time.
 */
export async function getDb(): Promise<Db> {
  globalForDb.__db ??= createDb();
  const db = await globalForDb.__db;

  if (!databaseUrl() && process.env.NODE_ENV !== "production") {
    const count = migrationCount();
    if (globalForDb.__dbMigrated?.count !== count) {
      globalForDb.__dbMigrated = { count, run: migrateLocal(db) };
    }
    await globalForDb.__dbMigrated.run;
  }
  return db;
}
