import { closeDb, createDb, databaseUrl, runMigrations } from "../src/db/client";

async function main() {
  const db = await createDb();
  await runMigrations(db);
  await closeDb(db);
  console.log(`Migrations applied (${databaseUrl() ? "Postgres" : "local PGlite"}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
