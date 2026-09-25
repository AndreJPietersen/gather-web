import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — plain JS module shared with the runner script
import { MANIFEST } from "./manifest.mjs";

const repo = path.resolve(__dirname, "../..");
const rawFiles = fs.readdirSync(path.join(repo, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
const journal = JSON.parse(fs.readFileSync(path.join(__dirname, "migrations/meta/_journal.json"), "utf8")).entries as { tag: string }[];
const drizzleFiles = journal.map((e) => `${e.tag}.sql`);

const raw = (MANIFEST as string[]).filter((e) => e.startsWith("raw:")).map((e) => e.slice(4));
const drizzle = (MANIFEST as string[]).filter((e) => e.startsWith("drizzle:")).map((e) => e.slice(8));

describe("migration manifest", () => {
  it("lists every raw Supabase migration exactly once", () => {
    expect([...raw].sort()).toEqual(rawFiles);
  });

  it("lists every Drizzle migration exactly once, in journal order", () => {
    expect(drizzle).toEqual(drizzleFiles);
  });

  it("has no unknown entries", () => {
    expect(MANIFEST.length).toBe(raw.length + drizzle.length);
  });

  it("keeps the frozen bootstrap order for the first 73 entries", () => {
    // Reordering existing entries breaks fresh-database builds. New migrations
    // are appended after this point.
    expect(MANIFEST.slice(0, 3)).toEqual([
      "raw:00000000000002_rls_helper_functions.sql",
      "raw:00000000000003_restore_public_grants.sql",
      "raw:00000000000004_event_pending_invitee_function.sql",
    ]);
    expect(MANIFEST.indexOf("raw:00000000000010_gallery_storage_buckets.sql")).toBeLessThan(
      MANIFEST.indexOf("raw:00000000000011_is_vendor_verified_function.sql"),
    );
  });
});
