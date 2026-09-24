import { describe, expect, it } from "vitest";
import { describePosition, getPlacementState } from "./feature-placements";

const window = { starts_on: "2026-10-01", ends_on: "2026-10-31" };

describe("getPlacementState", () => {
  it("is pending or cancelled whatever the dates say", () => {
    expect(getPlacementState({ status: "pending", ...window }, "2026-10-15")).toBe("pending");
    expect(getPlacementState({ status: "cancelled", ...window }, "2026-10-15")).toBe("cancelled");
  });

  it("is scheduled before the start, live inside the window, ended after it", () => {
    expect(getPlacementState({ status: "activated", ...window }, "2026-09-30")).toBe("scheduled");
    expect(getPlacementState({ status: "activated", ...window }, "2026-10-15")).toBe("live");
    expect(getPlacementState({ status: "activated", ...window }, "2026-11-01")).toBe("ended");
  });

  it("treats both the start and end dates as inclusive", () => {
    expect(getPlacementState({ status: "activated", ...window }, "2026-10-01")).toBe("live");
    expect(getPlacementState({ status: "activated", ...window }, "2026-10-31")).toBe("live");
  });
});

describe("describePosition", () => {
  it("labels pinned positions and the rotating pool", () => {
    expect(describePosition(1)).toBe("#1");
    expect(describePosition(null)).toBe("Rotating");
  });
});
