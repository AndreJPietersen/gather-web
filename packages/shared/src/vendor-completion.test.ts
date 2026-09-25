import { describe, expect, it } from "vitest";
import { getVendorCompletion } from "./vendor-completion";

const EMPTY = { logoPath: null, description: null, galleryCount: 0, servicesCount: 0, socialLinksCount: 0 };
const FULL = { logoPath: "abc/logo.png", description: "We do great work.", galleryCount: 5, servicesCount: 2, socialLinksCount: 1 };

describe("getVendorCompletion", () => {
  it("is 0% with nothing filled in", () => {
    const result = getVendorCompletion(EMPTY);
    expect(result.doneCount).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.items.every((item) => !item.done)).toBe(true);
  });

  it("is 100% with everything filled in", () => {
    const result = getVendorCompletion(FULL);
    expect(result.doneCount).toBe(result.totalCount);
    expect(result.percent).toBe(100);
  });

  it("requires at least 3 gallery photos, not just 1", () => {
    const result = getVendorCompletion({ ...EMPTY, galleryCount: 1 });
    const galleryItem = result.items.find((item) => item.key === "gallery");
    expect(galleryItem?.done).toBe(false);
    expect(galleryItem?.detail).toBe("1 of 3 added");
  });

  it("treats a whitespace-only description as not done", () => {
    const result = getVendorCompletion({ ...EMPTY, description: "   " });
    expect(result.items.find((item) => item.key === "description")?.done).toBe(false);
  });

  it("computes a partial percentage from a mix of done/not-done items", () => {
    // logo + services done, description/gallery/social not — 2 of 5.
    const result = getVendorCompletion({ ...EMPTY, logoPath: "x", servicesCount: 1 });
    expect(result.doneCount).toBe(2);
    expect(result.percent).toBe(40);
  });
});
