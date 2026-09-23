import type { createClient } from "@/lib/supabase/server";
import { getVendorCompletion } from "@/lib/vendor-completion";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface RankableVendor {
  id: string;
  verification_status: "unclaimed" | "claim_pending" | "verified";
  is_featured: boolean;
  logo_path: string | null;
  description: string | null;
  created_at: string;
}

const VERIFICATION_RANK: Record<RankableVendor["verification_status"], number> = {
  verified: 2,
  claim_pending: 1,
  unclaimed: 0,
};

// Shared by every surface that lists vendors competitively (Home's teaser,
// the /vendors marketplace, the guest landing page) so the sort order can't
// drift between them the way copy-pasted logic eventually would. Batches
// the three counts every vendor's completion score needs into 3 flat
// queries total, regardless of how many vendors are being ranked — the
// same "fetch once, reduce into a Set/Map in JS" shape this app's other
// per-list aggregations (My Events' pending-task/payment badges, etc.)
// already use, rather than an N+1 query per vendor.
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

  const countBy = (rows: { vendor_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      map.set(row.vendor_id, (map.get(row.vendor_id) ?? 0) + 1);
    }
    return map;
  };
  const galleryCounts = countBy(galleryRows);
  const serviceCounts = countBy(serviceRows);
  const socialCounts = countBy(socialRows);

  const ranked = vendors.map((vendor) => ({
    ...vendor,
    completionPercent: getVendorCompletion({
      logoPath: vendor.logo_path,
      description: vendor.description,
      galleryCount: galleryCounts.get(vendor.id) ?? 0,
      servicesCount: serviceCounts.get(vendor.id) ?? 0,
      socialLinksCount: socialCounts.get(vendor.id) ?? 0,
    }).percent,
  }));

  ranked.sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    if (a.completionPercent !== b.completionPercent) return b.completionPercent - a.completionPercent;
    const verificationDiff = VERIFICATION_RANK[b.verification_status] - VERIFICATION_RANK[a.verification_status];
    if (verificationDiff !== 0) return verificationDiff;
    return b.created_at.localeCompare(a.created_at);
  });

  return ranked;
}
