import type { createClient } from "@/lib/supabase/server";
import { countByVendor, rankVendorsWithCounts, type RankableVendor } from "@gather/shared/vendor-ranking";

// The ordering (featured pinned/rotating, completion, verification, newest)
// lives in @gather/shared so native uses the identical rules; re-exported so
// existing imports keep working. Only the database reads stay here.
export * from "@gather/shared/vendor-ranking";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Batches the three counts every vendor's completion score needs into 3 flat
// queries total, regardless of how many vendors are being ranked — the same
// "fetch once, reduce into a Map in JS" shape this app's other per-list
// aggregations already use, rather than an N+1 query per vendor.
export async function rankVendors<T extends RankableVendor>(
  supabase: SupabaseServerClient,
  vendors: T[],
): Promise<(T & { completionPercent: number })[]> {
  if (vendors.length === 0) return [];

  const ids = vendors.map((v) => v.id);
  const [{ data: galleryRows }, { data: serviceRows }, { data: socialRows }] = await Promise.all([
    supabase.from("vendor_gallery_images").select("vendor_id").in("vendor_id", ids).returns<{ vendor_id: string }[]>(),
    supabase.from("vendor_services").select("vendor_id").in("vendor_id", ids).returns<{ vendor_id: string }[]>(),
    supabase.from("vendor_social_links").select("vendor_id").in("vendor_id", ids).returns<{ vendor_id: string }[]>(),
  ]);

  return rankVendorsWithCounts(vendors, {
    gallery: countByVendor(galleryRows),
    services: countByVendor(serviceRows),
    social: countByVendor(socialRows),
  });
}
