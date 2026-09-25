import type { createClient } from "@/lib/supabase/server";
import { getVendorCompletion } from "@/lib/vendor-completion";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface RankableVendor {
  id: string;
  verification_status: "unclaimed" | "claim_pending" | "verified";
  is_featured: boolean;
  // Pinned position among featured vendors (1 = first), or null for the
  // rotating pool. Only meaningful when is_featured is true — see the
  // featured_rank() computed column in the vendor_featured_functions migration.
  featured_rank: number | null;
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

  return sortRankedVendors(ranked, sastDayKey());
}

// Today in South African time (UTC+2, no DST) as YYYY-MM-DD — the seed for the
// featured rotation, so it turns over at local midnight, not at 02:00.
export function sastDayKey(nowMs: number = Date.now()): string {
  return new Date(nowMs + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// FNV-1a — a tiny stable string hash, only used to shuffle the rotating pool.
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// The ordering itself, pure so it can be tested. Featured vendors come first:
// pinned ones by position (1, 2, 3…), then the rotating pool. The rotation is
// seeded by the day, so each rotating vendor keeps the same place all day (a
// page reload never reshuffles, and caching is safe) but the order turns over
// daily, which is what makes an unpinned paid placement fair over its window.
// Everything else — and any ties — falls back to the original order: profile
// completion, then verification, then newest.
export function sortRankedVendors<T extends RankableVendor & { completionPercent: number }>(
  vendors: T[],
  dayKey: string,
): T[] {
  return [...vendors].sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    if (a.is_featured && b.is_featured) {
      const aPinned = a.featured_rank !== null;
      const bPinned = b.featured_rank !== null;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (aPinned && bPinned && a.featured_rank !== b.featured_rank) return a.featured_rank! - b.featured_rank!;
      if (!aPinned && !bPinned) {
        const diff = hashString(`${dayKey}:${a.id}`) - hashString(`${dayKey}:${b.id}`);
        if (diff !== 0) return diff;
      }
    }
    if (a.completionPercent !== b.completionPercent) return b.completionPercent - a.completionPercent;
    const verificationDiff = VERIFICATION_RANK[b.verification_status] - VERIFICATION_RANK[a.verification_status];
    if (verificationDiff !== 0) return verificationDiff;
    return b.created_at.localeCompare(a.created_at);
  });
}
