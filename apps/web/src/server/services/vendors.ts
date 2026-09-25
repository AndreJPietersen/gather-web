import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenBusinessRequests, getOwnedBusinesses } from "@/lib/owned-businesses";
import { getMaxOwnedBusinesses } from "@/lib/app-settings";
import { checkBusinessRules, findUsableApproval, sameCategory, type BusinessRuleCheck } from "@gather/shared/vendor-business-rules";
import type { Caller } from "@/server/context";
import { fail, invalid, ok, type ServiceResult } from "@/server/result";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Business name is too short").max(150),
  primaryCategory: z.string().trim().min(1, "Choose a category").max(100),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
});

export type BlockedDetails = BusinessRuleCheck & { name: string; primaryCategory: string; hasPendingRequest: boolean };

// Creating a business the caller will Own. The vendor row is inserted as the
// caller (vendors_insert_authenticated pins created_by to them); the Owner
// membership row goes through the service role, because that's the only way
// to become a new business's first Owner — the old self-insert RLS policy
// was dropped so the owner rules below can't be skipped by calling the API
// directly.
//
// The rules: at most N owned businesses (admin-set, default 5), and no two
// in the same category, unless an admin has approved an exception request
// covering this one. A blocked attempt is a 409 with code
// "business_rules_blocked" and `details.blocked` describing what's needed.
export async function registerVendorBusiness(caller: Caller, input: unknown): Promise<ServiceResult<{ vendorId: string }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const { name, primaryCategory, description, phone, website } = parsed.data;

  const [owned, openRequests, maxOwned] = await Promise.all([
    getOwnedBusinesses(caller.userId, caller.supabase),
    getOpenBusinessRequests(caller.userId, caller.supabase),
    getMaxOwnedBusinesses(),
  ]);
  const check = checkBusinessRules(owned, primaryCategory, maxOwned);
  let approvalId: string | null = null;
  if (check.overLimit || check.duplicateCategory) {
    const approvals = openRequests
      .filter((r) => r.status === "approved")
      .map((r) => ({
        id: r.id,
        primaryCategory: r.primary_category,
        needsExtraSlot: r.needs_extra_slot,
        needsDuplicateCategory: r.needs_duplicate_category,
      }));
    const approval = findUsableApproval(approvals, check, primaryCategory);
    if (!approval) {
      const blocked: BlockedDetails = {
        ...check,
        name,
        primaryCategory,
        hasPendingRequest: openRequests.some((r) => r.status === "pending"),
      };
      return fail(409, "business_rules_blocked", "This business needs an admin's approval first.", { blocked });
    }
    approvalId = approval.id;
  }

  const { data: vendor, error: vendorError } = await caller.supabase
    .from("vendors")
    .insert({
      name,
      primary_category: primaryCategory,
      description: description || null,
      phone: phone || null,
      website: website || null,
      created_by: caller.userId,
    })
    .select("id")
    .single();

  if (vendorError || !vendor) {
    // Raised by the enforce_listing_daily_limit trigger (migration 0046).
    if (vendorError?.message.includes("Daily listing limit")) {
      return fail(429, "daily_limit", "You've created the maximum number of listings for today. Please try again tomorrow.");
    }
    return fail(500, "create_failed", "Something went wrong creating your business. Please try again.");
  }

  const service = createServiceClient();
  const { error: memberError } = await service.from("vendor_team_members").insert({
    vendor_id: vendor.id,
    user_id: caller.userId,
    role: "owner",
  });
  if (memberError) {
    return fail(500, "owner_setup_failed", "Your business was created, but we couldn't set you up as its owner. Please contact support.");
  }

  if (approvalId) {
    await service
      .from("vendor_business_requests")
      .update({ status: "used", used_vendor_id: vendor.id })
      .eq("id", approvalId)
      .eq("status", "approved");
  }
  return ok({ vendorId: vendor.id });
}

const requestSchema = z.object({
  name: z.string().trim().min(2).max(150),
  primaryCategory: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(10, "Tell us a little about why (at least a sentence).").max(1000),
});

// Asks an admin to allow one business the rules would otherwise block. Which
// rules it needs lifting is worked out again here from the database, not
// taken from the caller, so the request always says what's really needed.
export async function requestBusinessException(caller: Caller, input: unknown): Promise<ServiceResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message, "Please check your request.");

  const check = checkBusinessRules(
    await getOwnedBusinesses(caller.userId, caller.supabase),
    parsed.data.primaryCategory,
    await getMaxOwnedBusinesses(),
  );
  if (!check.overLimit && !check.duplicateCategory) {
    return fail(409, "not_needed", "You don't need approval for this one — go back and create it.");
  }

  const { error } = await caller.supabase.from("vendor_business_requests").insert({
    requester_id: caller.userId,
    business_name: parsed.data.name,
    primary_category: parsed.data.primaryCategory,
    needs_extra_slot: check.overLimit,
    needs_duplicate_category: check.duplicateCategory,
    reason: parsed.data.reason,
  });
  if (error) {
    // 23505 = the one-pending-request-per-user unique index.
    return error.code === "23505"
      ? fail(409, "already_pending", "You already have a request waiting for review.")
      : fail(500, "request_failed", "Something went wrong sending your request. Please try again.");
  }
  return ok();
}

const updateSchema = z.object({
  vendorId: z.string().uuid(),
  name: z.string().trim().min(2, "Business name is too short").max(150),
  primaryCategory: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
});

// RLS (vendors_update_creator_stub_or_owner_manager) is the real
// enforcement of who may edit; the category clash check is what RLS can't
// express.
export async function updateVendorBusiness(caller: Caller, input: unknown): Promise<ServiceResult<{ vendorId: string }>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const { vendorId, name, primaryCategory, description, phone, website } = parsed.data;

  // The one-business-per-category owner rule would be pointless if a
  // business could simply be re-categorised after creation, so a category
  // *change* is checked against every other business this one's Owners own.
  // Read through the service role: the editor can't see other owners'
  // memberships of other businesses. An unchanged category is never
  // re-checked, so a business created through an approved exception keeps
  // saving normally.
  const { data: current } = await caller.supabase.from("vendors").select("primary_category").eq("id", vendorId).maybeSingle();
  if (primaryCategory && current && !sameCategory(current.primary_category, primaryCategory)) {
    const clash = await findCategoryClash(vendorId, primaryCategory);
    if (clash) {
      return fail(
        409,
        "category_clash",
        `An owner of this business already owns ${clash}, which is also ${primaryCategory}. Each owner can have one business per category — report an issue from your Profile if you need an exception.`,
      );
    }
  }

  // .select("id").single() errors on zero rows — which is exactly what
  // happens if RLS silently filtered out an unauthorized update, so this
  // doubles as the authorization check.
  const { data: vendor, error } = await caller.supabase
    .from("vendors")
    .update({
      name,
      primary_category: primaryCategory || null,
      description: description || null,
      phone: phone || null,
      website: website || null,
    })
    .eq("id", vendorId)
    .select("id")
    .single();
  if (error || !vendor) {
    return fail(403, "update_failed", "Something went wrong saving your business details. Please try again.");
  }
  return ok({ vendorId: vendor.id });
}

// The name of another business, owned by one of this business's Owners,
// already in the given category — or null if there's no clash.
async function findCategoryClash(vendorId: string, category: string): Promise<string | null> {
  const service = createServiceClient();
  const { data: owners } = await service
    .from("vendor_team_members")
    .select("user_id")
    .eq("vendor_id", vendorId)
    .eq("role", "owner")
    .eq("is_active", true);
  const ownerIds = (owners ?? []).map((o) => o.user_id);
  if (ownerIds.length === 0) return null;

  const { data: others } = await service
    .from("vendor_team_members")
    .select("vendors(name, primary_category)")
    .in("user_id", ownerIds)
    .eq("role", "owner")
    .eq("is_active", true)
    .neq("vendor_id", vendorId)
    .returns<{ vendors: { name: string; primary_category: string | null } | null }[]>();
  const clash = (others ?? []).find((row) => sameCategory(row.vendors?.primary_category, category));
  return clash?.vendors?.name ?? null;
}
