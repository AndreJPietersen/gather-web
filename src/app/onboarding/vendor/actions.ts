"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenBusinessRequests, getOwnedBusinesses } from "@/lib/owned-businesses";
import { getMaxOwnedBusinesses } from "@/lib/app-settings";
import { checkBusinessRules, findUsableApproval, type BusinessRuleCheck } from "@/lib/vendor-business-rules";

const schema = z.object({
  name: z.string().trim().min(2, "Business name is too short").max(150),
  primaryCategory: z.string().trim().min(1, "Choose a category").max(100),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
});

export interface VendorOnboardingState {
  error?: string;
  // Set when the business breaks an owner rule (limit or duplicate category)
  // and no approved request covers it — the form then offers to ask an admin.
  blocked?: BusinessRuleCheck & { name: string; primaryCategory: string; hasPendingRequest: boolean };
}

// Creating a business the user will Own. The vendor row is inserted as the
// real signed-in user (vendors_insert_authenticated pins created_by to
// them); the Owner membership row goes through the service role, because
// that's now the only way to become a new business's first Owner — the old
// self-insert RLS policy was dropped so the owner rules below can't be
// skipped by calling the API directly (see the note in schema.ts).
//
// The rules: at most N owned businesses (admin-set, default 5), and no two in the same category,
// unless an admin has approved an exception request covering this one.
export async function registerVendorBusiness(
  _prevState: VendorOnboardingState,
  formData: FormData,
): Promise<VendorOnboardingState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    primaryCategory: formData.get("primaryCategory"),
    description: formData.get("description"),
    phone: formData.get("phone"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { name, primaryCategory, description, phone, website } = parsed.data;

  const [owned, openRequests, maxOwned] = await Promise.all([
    getOwnedBusinesses(user.id),
    getOpenBusinessRequests(user.id),
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
      return {
        blocked: {
          ...check,
          name,
          primaryCategory,
          hasPendingRequest: openRequests.some((r) => r.status === "pending"),
        },
      };
    }
    approvalId = approval.id;
  }

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .insert({
      name,
      primary_category: primaryCategory,
      description: description || null,
      phone: phone || null,
      website: website || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (vendorError || !vendor) {
    // Raised by the enforce_listing_daily_limit trigger (migration 0046).
    if (vendorError?.message.includes("Daily listing limit")) {
      return { error: "You've created the maximum number of listings for today. Please try again tomorrow." };
    }
    return { error: "Something went wrong creating your business. Please try again." };
  }

  const service = createServiceClient();
  const { error: memberError } = await service.from("vendor_team_members").insert({
    vendor_id: vendor.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    return { error: "Your business was created, but we couldn't set you up as its owner. Please contact support." };
  }

  if (approvalId) {
    await service
      .from("vendor_business_requests")
      .update({ status: "used", used_vendor_id: vendor.id })
      .eq("id", approvalId)
      .eq("status", "approved");
  }

  // This insert doesn't mutate a cookie, so it doesn't get Next's automatic
  // "cookie mutation re-renders the current page" treatment — without this,
  // the root layout's session/persona data (read from vendor_team_members)
  // can still be served stale from the client Router Cache on redirect,
  // showing the Planner tab set instead of the new Vendor one. Found by
  // testing the actual redirect target, not assumed from the docs alone.
  revalidatePath("/", "layout");
  redirect(`/vendor/${vendor.id}/dashboard`);
}

const requestSchema = z.object({
  name: z.string().trim().min(2).max(150),
  primaryCategory: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(10, "Tell us a little about why (at least a sentence).").max(1000),
});

export interface BusinessRequestState {
  error?: string;
}

// Asks an admin to allow one business the rules would otherwise block. Which
// rules it needs lifting is worked out again here from the database, not
// taken from the form, so the request always says what's really needed.
export async function requestBusinessException(
  _prevState: BusinessRequestState,
  formData: FormData,
): Promise<BusinessRequestState> {
  const parsed = requestSchema.safeParse({
    name: formData.get("name"),
    primaryCategory: formData.get("primaryCategory"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const check = checkBusinessRules(
    await getOwnedBusinesses(user.id),
    parsed.data.primaryCategory,
    await getMaxOwnedBusinesses(),
  );
  if (!check.overLimit && !check.duplicateCategory) {
    return { error: "You don't need approval for this one — go back and create it." };
  }

  const { error } = await supabase.from("vendor_business_requests").insert({
    requester_id: user.id,
    business_name: parsed.data.name,
    primary_category: parsed.data.primaryCategory,
    needs_extra_slot: check.overLimit,
    needs_duplicate_category: check.duplicateCategory,
    reason: parsed.data.reason,
  });
  if (error) {
    // 23505 = the one-pending-request-per-user unique index.
    return {
      error:
        error.code === "23505"
          ? "You already have a request waiting for review."
          : "Something went wrong sending your request. Please try again.",
    };
  }

  revalidatePath("/onboarding/vendor");
  revalidatePath("/admin/vendors/requests");
  redirect("/onboarding/vendor?requested=1");
}
