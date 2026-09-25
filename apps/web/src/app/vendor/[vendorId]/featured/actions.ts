"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { endDateFor, findPrice, type FeatureDuration, type FeatureSpot } from "@gather/shared/feature-pricing";
import { getFeaturePrices } from "@/lib/vendor-feature-status";
import { sastDayKey } from "@/lib/vendor-ranking";
import { getVendorAccess } from "../access";
import { getFeaturedEnabled } from "@/lib/app-settings";

export interface FeatureRequestState {
  error?: string;
}

const requestSchema = z.object({
  vendorId: z.string().uuid(),
  spot: z.enum(["top", "rotating"], { message: "Choose a type of spot." }),
  duration: z.enum(["1_week", "1_month", "3_months"], { message: "Choose how long." }),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
  vendorNote: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

// A vendor asking to be featured. Owner-only (it commits the business to
// paying), checked here in code because the write goes through the service
// role: vendor_feature_placements has no RLS policies, so its private fee
// and admin-note columns are never exposed to vendors. Creates a PENDING
// placement — nothing goes live until an admin activates it — pre-filled
// with the vendor's choices and the listed price at the time of asking.
export async function requestFeaturedPlacement(_prev: FeatureRequestState, formData: FormData): Promise<FeatureRequestState> {
  const parsed = requestSchema.safeParse({
    vendorId: formData.get("vendorId"),
    spot: formData.get("spot"),
    duration: formData.get("duration"),
    startsOn: formData.get("startsOn"),
    vendorNote: formData.get("vendorNote") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your choices." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired — please log in again." };
  }
  const access = await getVendorAccess(v.vendorId, user.id);
  if (access.role !== "owner") {
    return { error: "Only the business owner can request a featured spot." };
  }
  if (!(await getFeaturedEnabled())) {
    return { error: "Featured spots aren't available right now." };
  }
  if (v.startsOn < sastDayKey()) {
    return { error: "The start date can't be in the past." };
  }

  const service = createServiceClient();
  // One open request at a time.
  const { count } = await service
    .from("vendor_feature_placements")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", v.vendorId)
    .eq("status", "pending");
  if ((count ?? 0) > 0) {
    return { error: "You already have a request waiting. Withdraw it first if you want to change it." };
  }

  const prices = await getFeaturePrices();
  const { error } = await service.from("vendor_feature_placements").insert({
    vendor_id: v.vendorId,
    status: "pending",
    starts_on: v.startsOn,
    ends_on: endDateFor(v.startsOn, v.duration as FeatureDuration),
    position: null,
    fee_amount: findPrice(prices, v.spot as FeatureSpot, v.duration as FeatureDuration),
    requested_by: user.id,
    requested_spot: v.spot,
    requested_duration: v.duration,
    vendor_note: v.vendorNote ? v.vendorNote : null,
    created_by: user.id,
  });
  if (error) {
    return { error: "Something went wrong sending your request. Please try again." };
  }

  revalidatePath(`/vendor/${v.vendorId}/dashboard`);
  revalidatePath(`/vendor/${v.vendorId}/featured`);
  revalidatePath("/admin/featured");
  revalidatePath("/vendors");
  redirect(`/vendor/${v.vendorId}/featured?sent=1`);
}

const withdrawSchema = z.object({ vendorId: z.string().uuid(), placementId: z.string().uuid() });

// Withdraws the vendor's own pending request (cancels it). Only a pending
// placement can be withdrawn this way — once an admin has activated it, a
// change has to go through Gather.
export async function withdrawFeaturedRequest(formData: FormData): Promise<void> {
  const parsed = withdrawSchema.safeParse({ vendorId: formData.get("vendorId"), placementId: formData.get("placementId") });
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const access = await getVendorAccess(parsed.data.vendorId, user.id);
  if (access.role !== "owner") return;

  const service = createServiceClient();
  await service
    .from("vendor_feature_placements")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.placementId)
    .eq("vendor_id", parsed.data.vendorId)
    .eq("status", "pending");

  revalidatePath(`/vendor/${parsed.data.vendorId}/dashboard`);
  revalidatePath(`/vendor/${parsed.data.vendorId}/featured`);
  revalidatePath("/admin/featured");
  revalidatePath("/vendors");
}
