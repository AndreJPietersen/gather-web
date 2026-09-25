import { describe, expect, it } from "vitest";
import { checkBusinessRules, findUsableApproval, DEFAULT_MAX_OWNED_BUSINESSES } from "./vendor-business-rules";

const owned = (...cats: (string | null)[]) => cats.map((primaryCategory) => ({ primaryCategory }));

describe("checkBusinessRules", () => {
  it("allows a first business", () => {
    expect(checkBusinessRules([], "Photography")).toEqual({ ownedCount: 0, limit: 5, overLimit: false, duplicateCategory: false });
  });

  it("flags a category the user already owns, ignoring case and spaces", () => {
    expect(checkBusinessRules(owned("Photography"), " photography ").duplicateCategory).toBe(true);
    expect(checkBusinessRules(owned("Photography", null), "Catering").duplicateCategory).toBe(false);
  });

  it("flags the limit at exactly the maximum", () => {
    const four = owned("A", "B", "C", "D");
    expect(checkBusinessRules(four, "E").overLimit).toBe(false);
    expect(checkBusinessRules([...four, { primaryCategory: "E" }], "F").overLimit).toBe(true);
    expect(DEFAULT_MAX_OWNED_BUSINESSES).toBe(5);
  });

  it("uses the admin-set limit when given", () => {
    expect(checkBusinessRules(owned("A", "B"), "C", 2).overLimit).toBe(true);
    expect(checkBusinessRules(owned("A", "B"), "C", 3)).toMatchObject({ limit: 3, overLimit: false });
  });
});

describe("findUsableApproval", () => {
  const slot = { id: "slot", primaryCategory: "Florals", needsExtraSlot: true, needsDuplicateCategory: false };
  const dupPhoto = { id: "dup", primaryCategory: "Photography", needsExtraSlot: false, needsDuplicateCategory: true };

  it("uses an extra-slot approval when only over the limit", () => {
    const check = { ownedCount: 5, limit: 5, overLimit: true, duplicateCategory: false };
    expect(findUsableApproval([dupPhoto, slot], check, "Catering")?.id).toBe("slot");
  });

  it("only uses a duplicate-category approval for its own category", () => {
    const check = { ownedCount: 1, limit: 5, overLimit: false, duplicateCategory: true };
    expect(findUsableApproval([dupPhoto], check, "photography")?.id).toBe("dup");
    expect(findUsableApproval([dupPhoto], check, "Catering")).toBeNull();
  });

  it("needs an approval covering both rules when both are broken", () => {
    const check = { ownedCount: 5, limit: 5, overLimit: true, duplicateCategory: true };
    expect(findUsableApproval([slot, dupPhoto], check, "Photography")).toBeNull();
    const both = { id: "both", primaryCategory: "Photography", needsExtraSlot: true, needsDuplicateCategory: true };
    expect(findUsableApproval([both], check, "Photography")?.id).toBe("both");
  });
});
