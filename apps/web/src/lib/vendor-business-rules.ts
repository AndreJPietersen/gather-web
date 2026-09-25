// The limits on how many vendor businesses one person can own, kept pure so
// they can be unit tested and shown in the UI ("2 of 5") from the same source
// the server action enforces.
//
// - At most maxOwned businesses where the user is an active Owner (admin-set,
//   app_settings.max_owned_businesses — default DEFAULT_MAX_OWNED_BUSINESSES).
// - No two of them in the same category (compared case-insensitively).
//
// Either can be lifted for one business at a time by an approved
// vendor_business_requests row (see findUsableApproval).

export const DEFAULT_MAX_OWNED_BUSINESSES = 5;

export interface OwnedBusiness {
  primaryCategory: string | null;
}

export interface BusinessRuleCheck {
  ownedCount: number;
  limit: number;
  overLimit: boolean;
  duplicateCategory: boolean;
}

export function sameCategory(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function checkBusinessRules(
  owned: OwnedBusiness[],
  category: string | null,
  maxOwned: number = DEFAULT_MAX_OWNED_BUSINESSES,
): BusinessRuleCheck {
  return {
    ownedCount: owned.length,
    limit: maxOwned,
    overLimit: owned.length >= maxOwned,
    duplicateCategory: owned.some((b) => sameCategory(b.primaryCategory, category)),
  };
}

export interface ApprovedRequest {
  id: string;
  primaryCategory: string | null;
  needsExtraSlot: boolean;
  needsDuplicateCategory: boolean;
}

// An approved request can be spent on a new business when it covers every
// rule that business breaks. A duplicate-category approval only covers the
// category it was asked for — approving "a second Photography business"
// shouldn't also allow a second Catering one.
export function findUsableApproval(
  approvals: ApprovedRequest[],
  check: BusinessRuleCheck,
  category: string | null,
): ApprovedRequest | null {
  return (
    approvals.find(
      (a) =>
        (!check.overLimit || a.needsExtraSlot) &&
        (!check.duplicateCategory || (a.needsDuplicateCategory && sameCategory(a.primaryCategory, category))),
    ) ?? null
  );
}
