import type { createClient } from "@/lib/supabase/server";

export interface SuggestedVendor {
  id: string;
  name: string;
  primary_category: string | null;
}

// Shared by the event detail page's Help Me Plan wizard (cap 4) and the
// event-scoped Vendors page's "Suggested Vendors" section (cap 8) —
// previously the same event_type_service_categories -> vendor_services
// cross-reference was hand-copied into both files, and had already started
// drifting in how each built its exclusion set.
//
// Queries vendor_services for *all* matching rows (capped generously, not
// tightly) and dedupes to distinct vendor ids before slicing to `limit`,
// rather than capping the vendor_services query itself to a small pool and
// deduping while iterating: a vendor with several services in a matched
// category could consume multiple slots of a small fixed pool, previously
// undercounting suggestions (showing fewer than `limit` even when that
// many distinct vendors genuinely matched). The 200-row cap below is a
// safety valve against a pathological number of matching services, not a
// tuned display limit — `limit` is what actually bounds what's shown.
export async function getSuggestedVendorsForEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { eventTypeId, excludeVendorIds, limit }: { eventTypeId: string | null; excludeVendorIds: string[]; limit: number },
): Promise<SuggestedVendor[]> {
  if (!eventTypeId) return [];

  const { data: mappings } = await supabase
    .from("event_type_service_categories")
    .select("service_category_id, service_categories!inner(is_active)")
    .eq("event_type_id", eventTypeId)
    .eq("service_categories.is_active", true);
  const categoryIds = (mappings ?? []).map((m) => m.service_category_id);
  if (categoryIds.length === 0) return [];

  const { data: serviceRows } = await supabase
    .from("vendor_services")
    .select("vendor_id")
    .in("category_id", categoryIds)
    .limit(200)
    .returns<{ vendor_id: string }[]>();

  const excluded = new Set(excludeVendorIds);
  const candidateIds = [...new Set((serviceRows ?? []).map((r) => r.vendor_id))].filter((id) => !excluded.has(id)).slice(0, limit);
  if (candidateIds.length === 0) return [];

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name, primary_category")
    .in("id", candidateIds)
    .returns<SuggestedVendor[]>();

  return vendors ?? [];
}
