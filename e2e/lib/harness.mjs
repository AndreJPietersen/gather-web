// Shared plumbing for the e2e / security scripts: configuration, pass/fail
// reporting with a real exit code, and small helpers. Every script imports
// from here so CI (e2e/suites.spec.ts) can just run them and check the exit
// code.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../..");
export const OUTPUT_DIR = path.join(REPO_ROOT, "e2e", ".output");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
// Screenshot prefix used by the scripts (a directory path ending in a slash).
export const S = OUTPUT_DIR.replace(/\\/g, "/") + "/";

// .env.local supplies the Supabase URL and keys for the local stack. In CI
// the same names come from real environment variables.
function loadEnv() {
  const file = path.join(REPO_ROOT, ".env.local");
  const fromFile = fs.existsSync(file)
    ? Object.fromEntries(
        fs
          .readFileSync(file, "utf8")
          .split(/\r?\n/)
          .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
          .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
      )
      : {};
  return { ...fromFile, ...process.env };
}
export const env = loadEnv();

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:54324";
export const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const TEST_PASSWORD = "GatherTest123!";
// Seeded local accounts (see e2e/README.md).
export const VENDOR_OWNER_EMAIL = "vendortest@gather.dev";
export const ADMIN_EMAIL = "phonetest@gather.dev";
export const DRE_VENDOR_ID = "03abd193-63d9-4ecc-94b6-85b8bb07a1a2";

export const sqlConnect = () => postgres(DB_URL);

// A Supabase client acting as the given user (or anonymous), i.e. exactly
// what someone with dev tools and the public anon key can do.
export const anonClient = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
export async function userClient(email, password = TEST_PASSWORD) {
  const c = anonClient();
  await c.auth.signInWithPassword({ email, password });
  return c;
}
export const serviceClient = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

export const launchBrowser = () => chromium.launch();

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
const results = [];
export const errs = []; // page errors / 5xx responses collected by scripts

export function check(label, ok, note = "") {
  results.push({ ok: !!ok, label, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${note ? " — " + note : ""}`);
}

// Call once, at the very end (after cleanup). Sets a failing exit code if any
// check failed or any page threw.
export function finish() {
  if (errs.length > 0) check("no page errors or 5xx responses", false, JSON.stringify(errs.slice(0, 5)));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0 || results.length === 0) process.exitCode = 1;
}

// A script that crashes must fail loudly, not print half its checks.
export function crash(err) {
  console.error("SCRIPT CRASHED:", err);
  process.exitCode = 1;
}

export async function login(browser, email, { width = 390, height = 900, scale = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${email}: ${e.message}`));
  p.on("response", (r) => {
    if (r.status() >= 500) errs.push(`${r.status()} ${r.url()}`);
  });
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', TEST_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
  await p.waitForLoadState("networkidle");
  return p;
}
