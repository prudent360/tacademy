// Copies PGlite's browser files into public/pglite so the SQL runner can load them as they ship.
// Bundling PGlite for the browser breaks it in production builds (its internal helpers go missing),
// so the worker imports these files directly instead. Run before dev and build; the output isn't committed.
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// The package entry lives in its dist folder, next to the files we need.
const dist = dirname(require.resolve("@electric-sql/pglite"));
const out = join(process.cwd(), "public", "pglite");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const wanted = (name) => /^(index|chunk-[A-Z0-9]+)\.js$/.test(name) || ["pglite.wasm", "pglite.data", "initdb.wasm"].includes(name);
const files = readdirSync(dist).filter(wanted);
for (const name of files) cpSync(join(dist, name), join(out, name));
console.log(`Copied ${files.length} PGlite files to public/pglite`);
