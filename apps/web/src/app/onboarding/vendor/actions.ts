"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { callerFromCookies } from "@/server/context";
import { registerVendorBusiness as register, requestBusinessException as requestException, type BlockedDetails } from "@/server/services/vendors";

// Thin Server Action wrappers: the rules live in src/server/services/vendors.ts,
// shared with the native apps' API (POST /api/v1/vendors, /api/v1/business-requests).

export interface VendorOnboardingState {
  error?: string;
  // Set when the business breaks an owner rule (limit or duplicate category)
  // and no approved request covers it — the form then offers to ask an admin.
  blocked?: BlockedDetails;
}

export async function registerVendorBusiness(_prevState: VendorOnboardingState, formData: FormData): Promise<VendorOnboardingState> {
  const caller = await callerFromCookies();
  if (!caller) redirect("/login");

  const result = await register(caller, {
    name: formData.get("name"),
    primaryCategory: formData.get("primaryCategory"),
    description: formData.get("description"),
    phone: formData.get("phone"),
    website: formData.get("website"),
  });
  if (!result.ok) {
    if (result.code === "business_rules_blocked") return { blocked: result.details?.blocked as BlockedDetails };
    return { error: result.message };
  }

  // This insert doesn't mutate a cookie, so it doesn't get Next's automatic
  // "cookie mutation re-renders the current page" treatment — without this,
  // the root layout's session/persona data (read from vendor_team_members)
  // can still be served stale from the client Router Cache on redirect,
  // showing the Planner tab set instead of the new Vendor one.
  revalidatePath("/", "layout");
  redirect(`/vendor/${result.data.vendorId}/dashboard`);
}

export interface BusinessRequestState {
  error?: string;
}

export async function requestBusinessException(_prevState: BusinessRequestState, formData: FormData): Promise<BusinessRequestState> {
  const caller = await callerFromCookies();
  if (!caller) redirect("/login");

  const result = await requestException(caller, {
    name: formData.get("name"),
    primaryCategory: formData.get("primaryCategory"),
    reason: formData.get("reason"),
  });
  if (!result.ok) return { error: result.message };

  revalidatePath("/onboarding/vendor");
  revalidatePath("/admin/vendors/requests");
  redirect("/onboarding/vendor?requested=1");
}
