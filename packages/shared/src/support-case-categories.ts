// Shared between the planner-facing "Report an Issue" form and anywhere a
// category needs a human label (the admin case list/detail) — one source of
// truth for the support_case_category enum's display text, so the two sides
// can't drift.
export const SUPPORT_CASE_CATEGORIES = [
  { value: "payments_billing", label: "Payments & Billing" },
  { value: "vendor_booking", label: "Vendor Booking & Communication" },
  { value: "event_setup", label: "Event Setup & Guests" },
  { value: "account_verification", label: "Account & Verification" },
  { value: "app_bug", label: "App Bug / Something Broken" },
  { value: "other", label: "Other" },
] as const;

export type SupportCaseCategory = (typeof SUPPORT_CASE_CATEGORIES)[number]["value"];

export function supportCaseCategoryLabel(category: string | null): string {
  return SUPPORT_CASE_CATEGORIES.find((c) => c.value === category)?.label ?? "Other";
}
