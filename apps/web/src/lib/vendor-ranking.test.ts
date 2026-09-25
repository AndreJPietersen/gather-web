import { describe, expect, it } from "vitest";
import { sastDayKey, sortRankedVendors, type RankableVendor } from "./vendor-ranking";

type TestVendor = RankableVendor & { completionPercent: number };

function vendor(id: string, overrides: Partial<TestVendor> = {}): TestVendor {
  return {
    id,
    verification_status: "verified",
    is_featured: false,
    featured_rank: null,
    logo_path: null,
    description: null,
    created_at: "2026-01-01T00:00:00Z",
    completionPercent: 50,
    ...overrides,
  };
}

const ids = (vendors: TestVendor[]) => vendors.map((v) => v.id);

describe("sortRankedVendors", () => {
  it("puts featured vendors before everyone else, however complete the others are", () => {
    const sorted = sortRankedVendors(
      [vendor("plain", { completionPercent: 100 }), vendor("paid", { is_featured: true, completionPercent: 10 })],
      "2026-09-23",
    );
    expect(ids(sorted)).toEqual(["paid", "plain"]);
  });

  it("orders pinned featured vendors by position, ahead of the rotating pool", () => {
    const sorted = sortRankedVendors(
      [
        vendor("rotating", { is_featured: true }),
        vendor("third", { is_featured: true, featured_rank: 3 }),
        vendor("first", { is_featured: true, featured_rank: 1 }),
        vendor("second", { is_featured: true, featured_rank: 2 }),
      ],
      "2026-09-23",
    );
    expect(ids(sorted)).toEqual(["first", "second", "third", "rotating"]);
  });

  it("keeps the rotating pool in the same order all day, whatever order it arrives in", () => {
    const pool = ["a", "b", "c", "d", "e", "f"].map((id) => vendor(id, { is_featured: true }));
    const forward = ids(sortRankedVendors(pool, "2026-09-23"));
    const backward = ids(sortRankedVendors([...pool].reverse(), "2026-09-23"));
    expect(backward).toEqual(forward);
  });

  it("changes the rotating order from one day to the next", () => {
    const pool = ["a", "b", "c", "d", "e", "f"].map((id) => vendor(id, { is_featured: true }));
    const orders = new Set(
      ["2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"].map((day) => ids(sortRankedVendors(pool, day)).join()),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("falls back to profile completion for vendors that are not featured", () => {
    const sorted = sortRankedVendors([vendor("low", { completionPercent: 20 }), vendor("high", { completionPercent: 90 })], "2026-09-23");
    expect(ids(sorted)).toEqual(["high", "low"]);
  });
});

describe("sastDayKey", () => {
  it("turns over at local midnight (22:00 UTC), not UTC midnight", () => {
    expect(sastDayKey(Date.parse("2026-09-23T21:59:00Z"))).toBe("2026-09-23");
    expect(sastDayKey(Date.parse("2026-09-23T22:00:00Z"))).toBe("2026-09-24");
  });
});
