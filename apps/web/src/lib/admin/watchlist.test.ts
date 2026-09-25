import { describe, expect, it } from "vitest";
import { splitDismissed, type WatchlistRow } from "./watchlist";

const row = (subject_key: string, hits: number): WatchlistRow => ({
  signal: "listing_burst",
  subject_key,
  subject_id: subject_key,
  subject_label: subject_key,
  hits,
  detail: null,
  vendor_ids: [],
});
const dismissal = (subject_key: string, hits: number) => ({
  id: `d-${subject_key}`,
  signal: "listing_burst",
  subject_key,
  hits_at_dismissal: hits,
  note: null,
});

describe("splitDismissed", () => {
  it("keeps undismissed entries active", () => {
    expect(splitDismissed([row("a", 6)], []).active).toHaveLength(1);
  });

  it("hides an entry while it hasn't grown since dismissal", () => {
    const { active, dismissed } = splitDismissed([row("a", 6)], [dismissal("a", 6)]);
    expect(active).toHaveLength(0);
    expect(dismissed[0].dismissalId).toBe("d-a");
  });

  it("brings an entry back once it grows", () => {
    expect(splitDismissed([row("a", 7)], [dismissal("a", 6)]).active).toHaveLength(1);
  });

  it("matches on signal as well as subject", () => {
    const other = { ...dismissal("a", 6), signal: "team_seats" };
    expect(splitDismissed([row("a", 6)], [other]).active).toHaveLength(1);
  });
});
