import { createServiceClient } from "@/lib/supabase/service";
import { getPlacementState, type PlacementStatus } from "@/lib/feature-placements";
import type { FeatureDuration, FeaturePriceRow, FeatureSpot } from "@/lib/feature-pricing";
import { sastDayKey } from "@/lib/vendor-ranking";

export interface VendorFeatureStatus {
  // A request (or admin-drafted placement) still waiting on confirmation.
  pending: {
    id: string;
    startsOn: string;
    endsOn: string;
    requestedSpot: FeatureSpot | null;
    requestedDuration: FeatureDuration | null;
  } | null;
  // The activated placement that is live now, or failing that the next one
  // scheduled to start.
  current: { startsOn: string; endsOn: string; state: "live" | "scheduled" } | null;
}

// What a vendor may see about their own featured placements. Reads through
// the service role because vendor_feature_placements has no RLS policies at
// all (its fee and admin note columns are private to Gather) — so CALLERS
// MUST have already checked the user is on this vendor's team, the same
// "verify in code, then use the service role" shape as the guest RSVP action.
// Only ever selects the columns a vendor is allowed to know about.
export async function getVendorFeatureStatus(vendorId: string): Promise<VendorFeatureStatus> {
  const service = createServiceClient();
  const { data } = await service
    .from("vendor_feature_placements")
    .select("id, status, starts_on, ends_on, requested_spot, requested_duration")
    .eq("vendor_id", vendorId)
    .in("status", ["pending", "activated"])
    .order("starts_on", { ascending: true })
    .returns<
      {
        id: string;
        status: PlacementStatus;
        starts_on: string;
        ends_on: string;
        requested_spot: FeatureSpot | null;
        requested_duration: FeatureDuration | null;
      }[]
    >();

  const today = sastDayKey();
  const rows = (data ?? []).map((row) => ({ ...row, state: getPlacementState(row, today) }));
  const pendingRow = rows.find((r) => r.state === "pending");
  const live = rows.filter((r) => r.state === "live").sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0];
  const scheduled = rows.find((r) => r.state === "scheduled");
  const currentRow = live ?? scheduled;

  return {
    pending: pendingRow
      ? {
          id: pendingRow.id,
          startsOn: pendingRow.starts_on,
          endsOn: pendingRow.ends_on,
          requestedSpot: pendingRow.requested_spot,
          requestedDuration: pendingRow.requested_duration,
        }
      : null,
    current: currentRow
      ? { startsOn: currentRow.starts_on, endsOn: currentRow.ends_on, state: currentRow.state as "live" | "scheduled" }
      : null,
  };
}

// The public price list (feature_prices is publicly readable; the service
// client is used only so this works the same from any server context).
export async function getFeaturePrices(): Promise<FeaturePriceRow[]> {
  const service = createServiceClient();
  const { data } = await service.from("feature_prices").select("spot, duration, amount").returns<FeaturePriceRow[]>();
  return data ?? [];
}
