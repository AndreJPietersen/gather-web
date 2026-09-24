import { describe, expect, it } from "vitest";
import { endDateFor, findPrice, nextDay } from "./feature-pricing";

describe("endDateFor", () => {
  it("makes a week seven days including the first", () => {
    expect(endDateFor("2026-10-01", "1_week")).toBe("2026-10-07");
    expect(endDateFor("2026-12-28", "1_week")).toBe("2027-01-03");
  });

  it("ends a month on the day before the same date next month", () => {
    expect(endDateFor("2026-10-01", "1_month")).toBe("2026-10-31");
    expect(endDateFor("2026-10-15", "1_month")).toBe("2026-11-14");
    expect(endDateFor("2026-12-10", "1_month")).toBe("2027-01-09");
  });

  it("ends on the last day of a short month when the start day does not exist there", () => {
    expect(endDateFor("2027-01-31", "1_month")).toBe("2027-02-28");
  });

  it("handles three months", () => {
    expect(endDateFor("2026-10-01", "3_months")).toBe("2026-12-31");
    expect(endDateFor("2026-11-30", "3_months")).toBe("2027-02-28");
  });
});

describe("nextDay", () => {
  it("rolls over months and years", () => {
    expect(nextDay("2026-10-31")).toBe("2026-11-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });
});

describe("findPrice", () => {
  it("returns the amount, or null when no price is set", () => {
    const prices = [
      { spot: "top" as const, duration: "1_week" as const, amount: "500.00" },
      { spot: "rotating" as const, duration: "1_week" as const, amount: null },
    ];
    expect(findPrice(prices, "top", "1_week")).toBe("500.00");
    expect(findPrice(prices, "rotating", "1_week")).toBeNull();
    expect(findPrice(prices, "top", "3_months")).toBeNull();
  });
});
