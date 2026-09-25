import { describe, expect, it } from "vitest";
import { isInstallmentOverdue, isDateOverdue } from "./upcoming";

describe("isInstallmentOverdue", () => {
  it("is overdue when pending and past its due date", () => {
    expect(isInstallmentOverdue("pending", "2026-09-01", "2026-09-16")).toBe(true);
  });

  it("is not overdue when pending and due today or in the future", () => {
    expect(isInstallmentOverdue("pending", "2026-09-16", "2026-09-16")).toBe(false);
    expect(isInstallmentOverdue("pending", "2026-09-20", "2026-09-16")).toBe(false);
  });

  it("is never overdue once paid, refunded, or cancelled, regardless of due date", () => {
    expect(isInstallmentOverdue("paid", "2026-01-01", "2026-09-16")).toBe(false);
    expect(isInstallmentOverdue("refunded", "2026-01-01", "2026-09-16")).toBe(false);
    expect(isInstallmentOverdue("cancelled", "2026-01-01", "2026-09-16")).toBe(false);
  });

  it("defaults todayIso to the real current date when not passed", () => {
    const farPast = "2000-01-01";
    expect(isInstallmentOverdue("pending", farPast)).toBe(true);
  });
});

describe("isDateOverdue", () => {
  it("is overdue once past the given date", () => {
    expect(isDateOverdue("2026-09-01", "2026-09-16")).toBe(true);
  });

  it("is not overdue on or before the given date", () => {
    expect(isDateOverdue("2026-09-16", "2026-09-16")).toBe(false);
    expect(isDateOverdue("2026-09-20", "2026-09-16")).toBe(false);
  });
});
