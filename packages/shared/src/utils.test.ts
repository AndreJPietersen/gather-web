import { describe, expect, it } from "vitest";
import { cn, formatEventDateTime, formatZAR, getCountdownRemaining, isoToSastInput, sastInputToIso } from "./utils";

describe("cn", () => {
  it("merges conditional class names", () => {
    expect(cn("px-4", false && "hidden", "text-sm")).toBe("px-4 text-sm");
  });

  it("resolves conflicting Tailwind utilities in favor of the last one", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });
});

describe("formatZAR", () => {
  it("formats a numeric string as ZAR currency", () => {
    // The exact whitespace character Intl uses between "R" and the amount
    // is a non-breaking space (U+00A0), not a regular one — asserting via
    // a regex avoids the test itself being wrong about that.
    expect(formatZAR("4500")).toMatch(/^R\s*4\s*500,00$/);
  });

  it("formats a JS number the same way as its string equivalent", () => {
    expect(formatZAR(1500.5)).toBe(formatZAR("1500.50"));
  });

  it("formats zero correctly", () => {
    expect(formatZAR(0)).toMatch(/0,00$/);
  });
});

describe("sastInputToIso / isoToSastInput round-trip", () => {
  it("converts a SAST datetime-local value to the correct UTC instant", () => {
    // 15:00 SAST (UTC+2) is 13:00 UTC.
    const iso = sastInputToIso("2027-01-10T15:00");
    expect(new Date(iso).toISOString()).toBe("2027-01-10T13:00:00.000Z");
  });

  it("round-trips back to the same datetime-local value", () => {
    const original = "2027-06-15T09:30";
    expect(isoToSastInput(sastInputToIso(original))).toBe(original);
  });

  it("returns an empty string for a null timestamp", () => {
    expect(isoToSastInput(null)).toBe("");
  });
});

describe("formatEventDateTime", () => {
  it("formats an ISO timestamp in the Africa/Johannesburg timezone", () => {
    // Regardless of the machine running this test, the displayed time
    // should reflect SAST (UTC+2), not the local system timezone.
    const formatted = formatEventDateTime("2027-01-10T13:00:00.000Z");
    expect(formatted).toContain("15:00");
  });
});

describe("getCountdownRemaining", () => {
  const now = new Date("2027-01-01T00:00:00.000Z").getTime();

  it("splits a future timestamp into days/hours/minutes/seconds", () => {
    // 2 days, 3 hours, 4 minutes, 5 seconds out.
    const target = new Date(now + 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000).toISOString();
    expect(getCountdownRemaining(target, now)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5, done: false });
  });

  it("reports done for a timestamp exactly now", () => {
    expect(getCountdownRemaining(new Date(now).toISOString(), now).done).toBe(true);
  });

  it("reports done for a past timestamp, never negative values", () => {
    const target = new Date(now - 60_000).toISOString();
    expect(getCountdownRemaining(target, now)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });

  it("defaults to the real current time when nowMs is omitted", () => {
    const soon = new Date(Date.now() + 60_000).toISOString();
    const result = getCountdownRemaining(soon);
    expect(result.done).toBe(false);
    expect(result.days).toBe(0);
  });
});
