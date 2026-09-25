// Applies Gather's database migrations — both folders, in the proven order
// from ../manifest.mjs — to any Postgres/Supabase database.
//
//   node scripts/migrate.mjs --status            what's applied / pending (changes nothing)
//   node scripts/migrate.mjs --dry-run           print what would run
//   node scripts/migrate.mjs                     apply everything pending
//   node scripts/migrate.mjs --adopt             one-time, for a database that already has
//                                                these migrations applied by hand or by the
//                                                old tools: record them WITHOUT running them
//   node scripts/migrate.mjs --remote            required for any database that isn't local
//
// DATABASE_URL defaults to the local Supabase stack.
//
// Each migration runs in its own transaction and is recorded in the tracking
// tables the native tools use, so `drizzle-kit` and `supabase` still see the
// right history:
//   drizzle."__drizzle_migrations"          (hash + folderMillis, exactly as drizzle-kit writes it)
//   supabase_migrations.schema_migrations   (version = leading digits of the file name)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { MANIFEST } from "../manifest.mjs";

const args = new Set(process.argv.slice(2));
const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const repo = path.resolve(import.meta.dirname, "../../..");
const rawDir = path.join(repo, "supabase", "migrations");
const drizzleDir = path.resolve(import.meta.dirname, "../migrations");
const journal = JSON.parse(fs.readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8")).entries;
const folderMillis = new Map(journal.map((e) => [e.tag + ".sql", e.when]));

const host = new URL(url).hostname;
const isLocal = ["127.0.0.1", "localhost", "::1", "host.docker.internal"].includes(host);
if (!isLocal && !args.has("--remote")) {
  console.error(`Refusing to touch ${host}: it isn't a local database. Re-run with --remote if that's intended.`);
  process.exit(2);
}

const steps = MANIFEST.map((entry) => {
  const [kind, file] = entry.split(":");
  const filePath = path.join(kind === "raw" ? rawDir : drizzleDir, file);
  const text = fs.readFileSync(filePath, "utf8");
  return {
    kind,
    file,
    text,
    // drizzle records a sha256 of the whole file plus the journal's timestamp
    hash: crypto.createHash("sha256").update(text).digest("hex"),
    millis: kind === "drizzle" ? folderMillis.get(file) : null,
    // supabase records the leading digits of the file name as the version
    version: kind === "raw" ? file.split("_")[0] : null,
    name: kind === "raw" ? file.slice(file.indexOf("_") + 1).replace(/\.sql$/, "") : null,
  };
});

const sql = postgres(url, { onnotice: () => {}, max: 1 });

async function ensureTrackers(tx) {
  await tx.unsafe(`create schema if not exists drizzle`);
  await tx.unsafe(`create table if not exists drizzle."__drizzle_migrations" (id serial primary key, hash text not null, created_at bigint)`);
  await tx.unsafe(`create schema if not exists supabase_migrations`);
  await tx.unsafe(
    `create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text)`,
  );
}

async function appliedSets(tx) {
  const dz = new Set((await tx`select created_at from drizzle."__drizzle_migrations"`).map((r) => Number(r.created_at)));
  const raw = new Set((await tx`select version from supabase_migrations.schema_migrations`).map((r) => r.version));
  return { dz, raw };
}

const isApplied = (s, sets) => (s.kind === "drizzle" ? sets.dz.has(s.millis) : sets.raw.has(s.version));

async function record(tx, s) {
  if (s.kind === "drizzle") {
    await tx`insert into drizzle."__drizzle_migrations" (hash, created_at) values (${s.hash}, ${s.millis})`;
  } else {
    await tx`insert into supabase_migrations.schema_migrations (version, name, statements) values (${s.version}, ${s.name}, ${[s.text]})`;
  }
}

async function apply(s) {
  await sql.begin(async (tx) => {
    // Helper functions are created before the tables they read exist (the
    // circular dependency the manifest exists for), so don't validate SQL
    // function bodies at creation time.
    await tx.unsafe("set local check_function_bodies = off");
    const statements = s.kind === "drizzle" ? s.text.split("--> statement-breakpoint") : [s.text];
    for (const st of statements) if (st.trim()) await tx.unsafe(st);
    await record(tx, s);
  });
}

try {
  await sql`select pg_advisory_lock(727274)`; // one runner at a time
  await sql.begin((tx) => ensureTrackers(tx));
  const sets = await appliedSets(sql);
  const pending = steps.filter((s) => !isApplied(s, sets));
  const applied = steps.length - pending.length;

  // A database that already holds these migrations but never recorded the raw
  // ones (they were applied by hand) must be adopted explicitly — guessing
  // would re-run them.
  const hasSchema = (await sql`select to_regclass('public.profiles') as t`)[0].t !== null;
  const pendingRaw = pending.filter((s) => s.kind === "raw").length;
  const looksAdoptable = hasSchema && pendingRaw > 0 && applied > 0;

  console.log(`${host}: ${applied}/${steps.length} migrations recorded as applied, ${pending.length} pending.`);
  if (args.has("--status")) {
    for (const s of pending) console.log(`  pending  ${s.kind}:${s.file}`);
  } else if (args.has("--adopt")) {
    await sql.begin(async (tx) => {
      for (const s of pending) {
        await record(tx, s);
        console.log(`  adopted  ${s.kind}:${s.file}`);
      }
    });
    console.log(pending.length ? "Adopted. Nothing was executed." : "Nothing to adopt.");
  } else if (looksAdoptable) {
    console.error(
      `\nThis database already has tables and ${applied} recorded migrations, but ${pendingRaw} raw migration(s) aren't recorded.\n` +
        `They were probably applied by hand. Running them again could fail or, worse, undo later changes.\n` +
        `If you've checked that this database really has them applied, run once with --adopt.`,
    );
    process.exitCode = 3;
  } else if (args.has("--dry-run")) {
    for (const s of pending) console.log(`  would apply  ${s.kind}:${s.file}`);
  } else {
    for (const s of pending) {
      process.stdout.write(`  applying  ${s.kind}:${s.file} ... `);
      try {
        await apply(s);
        console.log("ok");
      } catch (e) {
        console.log("FAILED");
        console.error(`\n${s.kind}:${s.file}: ${e.message}`);
        process.exitCode = 1;
        break;
      }
    }
    if (!process.exitCode) console.log(pending.length ? "Done." : "Already up to date.");
  }
} finally {
  await sql.end();
}
