import { describe, expect, it } from "vitest";
import { supportCaseCategoryLabel } from "./support-case-categories";

describe("supportCaseCategoryLabel", () => {
  it("resolves a known category value to its display label", () => {
    expect(supportCaseCategoryLabel("payments_billing")).toBe("Payments & Billing");
    expect(supportCaseCategoryLabel("app_bug")).toBe("App Bug / Something Broken");
  });

  it("falls back to \"Other\" for null — the admin-logged case path, which has no category to backfill", () => {
    expect(supportCaseCategoryLabel(null)).toBe("Other");
  });

  it("falls back to \"Other\" for an unrecognized value rather than throwing", () => {
    expect(supportCaseCategoryLabel("not-a-real-category")).toBe("Other");
  });
});
