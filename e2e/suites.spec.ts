import { spawn } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

// One Playwright test per suite script in e2e/scripts. A script prints
// PASS/FAIL lines and exits non-zero if any check failed (see
// e2e/lib/harness.mjs), so the test just runs it and checks the exit code,
// attaching the full output either way.
//
// Order matters a little: read-only security guards first, then the feature
// suites (which create and clean up their own data).
const SUITES: { name: string; file: string }[] = [
  { name: "security: database audit", file: "security-db-audit.mjs" },
  { name: "security: stranger can't edit anything", file: "security-stranger-sweep.mjs" },
  { name: "security: API exploit attempts", file: "security-exploits.mjs" },
  { name: "feature: native-app API (/api/v1)", file: "api-v1.mjs" },
  { name: "feature: account deletion (database)", file: "account-deletion.mjs" },
  { name: "feature: unused-file cleanup", file: "storage-cleanup.mjs" },
  { name: "feature: launch readiness (legal, reset, delete)", file: "launch-readiness.mjs" },
  { name: "smoke: core pages and forms", file: "smoke.mjs" },
  { name: "feature: featured vendors", file: "featured-vendors.mjs" },
  { name: "feature: owner limits and business requests", file: "business-rules.mjs" },
  { name: "feature: watchlist and team-membership locks", file: "watchlist.mjs" },
  { name: "feature: moderation and sign-up kill switch", file: "moderation.mjs" },
  { name: "feature: vendor staff permissions", file: "staff-permissions.mjs" },
  { name: "feature: admin email", file: "admin-email.mjs" },
];

function runScript(file: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, "scripts", file)], {
      cwd: path.join(__dirname, ".."),
      env: process.env,
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => resolve({ code, output }));
  });
}

for (const suite of SUITES) {
  test(suite.name, async ({}, testInfo) => {
    const { code, output } = await runScript(suite.file);
    await testInfo.attach("output", { body: output, contentType: "text/plain" });
    // Surface the useful lines in the assertion message (the full output is
    // attached too): failed checks, crashes, and the sweep's HOLE lines.
    const failures = output.split("\n").filter((l) => l.startsWith("FAIL") || l.includes("SCRIPT CRASHED") || l.includes("HOLE"));
    expect(code, `exit code ${code}\n${failures.join("\n") || output.slice(-1500)}`).toBe(0);
  });
}
