// Writes src/database.types.ts: TypeScript types for every table, view,
// function and enum in the database's `public` schema, generated from the
// real (migrated) database by the Supabase CLI.
//
//   node scripts/gen-types.mjs            regenerate the file
//   node scripts/gen-types.mjs --check    fail if the committed file is out of date
//
// Regenerate after adding a migration (`npm run db:types` at the repo root).
// CI runs --check after building a fresh database, so a migration without
// regenerated types fails the pull request.
//
// DATABASE_URL defaults to the local Supabase stack. The CLI runs a small
// helper container (Docker must be running, as for `supabase start`).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const file = path.resolve(import.meta.dirname, "../src/database.types.ts");
const check = process.argv.includes("--check");

const run = spawnSync("npx", ["supabase", "gen", "types", "typescript", "--db-url", url, "--schema", "public"], {
  encoding: "utf8",
  shell: process.platform === "win32",
  maxBuffer: 64 * 1024 * 1024,
});
if (run.status !== 0 || !run.stdout.includes("export type Database")) {
  console.error(run.stderr || "Type generation failed.");
  process.exit(1);
}
const generated = run.stdout.replace(/\r\n/g, "\n");

if (check) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
  if (current !== generated) {
    console.error("packages/db/src/database.types.ts is out of date. Run `npm run db:types` and commit the result.");
    process.exit(1);
  }
  console.log("database.types.ts is up to date.");
} else {
  fs.writeFileSync(file, generated);
  console.log(`Wrote ${path.relative(process.cwd(), file)} (${generated.split("\n").length} lines).`);
}
