import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { endDateFor, findPrice, type FeatureDuration, type FeatureSpot } from "@gather/shared/feature-pricing";
import { getFeaturePrices } from "@/lib/vendor-feature-status";
import { sastDayKey } from "@/lib/vendor-ranking";
import { getVendorAccess } from "@/app/vendor/[vendorId]/access";
import { getFeaturedEnabled } from "@/lib/app-settings";
import type { Caller } from "@/server/context";
import { fail, invalid, ok, type ServiceResult } from "@/server/result";

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
export async function requestFeaturedPlacement(caller: Caller, input: unknown): Promise<ServiceResult<{ vendorId: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message, "Please check your choices.");
  const v = parsed.data;

  const access = await getVendorAccess(v.vendorId, caller.userId, caller.supabase);
  if (access.role !== "owner") return fail(403, "not_owner", "Only the business owner can request a featured spot.");
  if (!(await getFeaturedEnabled())) return fail(409, "featured_off", "Featured spots aren't available right now.");
  if (v.startsOn < sastDayKey()) return fail(400, "validation_error", "The start date can't be in the past.");

  const service = createServiceClient();
  // One open request at a time.
  const { count } = await service
    .from("vendor_feature_placements")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", v.vendorId)
    .eq("status", "pending");
  if ((count ?? 0) > 0) {
    return fail(409, "already_pending", "You already have a request waiting. Withdraw it first if you want to change it.");
  }

  const prices = await getFeaturePrices();
  const { error } = await service.from("vendor_feature_placements").insert({
    vendor_id: v.vendorId,
    status: "pending",
    starts_on: v.startsOn,
    ends_on: endDateFor(v.startsOn, v.duration as FeatureDuration),
    position: null,
    fee_amount: findPrice(prices, v.spot as FeatureSpot, v.duration as FeatureDuration),
    requested_by: caller.userId,
    requested_spot: v.spot,
    requested_duration: v.duration,
    vendor_note: v.vendorNote ? v.vendorNote : null,
    created_by: caller.userId,
  });
  if (error) return fail(500, "request_failed", "Something went wrong sending your request. Please try again.");
  return ok({ vendorId: v.vendorId });
}

const withdrawSchema = z.object({ vendorId: z.string().uuid(), placementId: z.string().uuid() });

// Withdraws the vendor's own pending request (cancels it). Only a pending
// placement can be withdrawn this way — once an admin has activated it, a
// change has to go through Gather.
export async function withdrawFeaturedRequest(caller: Caller, input: unknown): Promise<ServiceResult<{ vendorId: string }>> {
  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return invalid(undefined, "Something went wrong. Please try again.");

  const access = await getVendorAccess(parsed.data.vendorId, caller.userId, caller.supabase);
  if (access.role !== "owner") return fail(403, "not_owner", "Only the business owner can withdraw a request.");

  const service = createServiceClient();
  const { data } = await service
    .from("vendor_feature_placements")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.placementId)
    .eq("vendor_id", parsed.data.vendorId)
    .eq("status", "pending")
    .select("id");
  if ((data ?? []).length === 0) return fail(404, "not_found", "There's no pending request to withdraw.");
  return ok({ vendorId: parsed.data.vendorId });
}
