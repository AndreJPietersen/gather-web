import { defineConfig } from "@playwright/test";

// The end-to-end and security suites (e2e/scripts/*.mjs) run as Playwright
// tests via e2e/suites.spec.ts — one test per suite, so CI and the HTML
// report show a clear pass/fail for each.
//
// They drive a running app against a real Supabase stack, so they are NOT
// part of `npm test` (Vitest) and CI runs them separately. Local run:
//   npm run db:start && npm run dev     (in other terminals)
//   npm run e2e                         (everything)
//   npm run e2e -- -g security          (only the security suites)
// Point them at another environment with E2E_BASE_URL, E2E_DB_URL and the
// NEXT_PUBLIC_SUPABASE_* / SUPABASE_SERVICE_ROLE_KEY variables.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /suites\.spec\.ts$/,
  // The suites share one database and change app settings, so run them one
  // at a time, in order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 10 * 60 * 1000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  outputDir: "./e2e/.output/playwright",
});
