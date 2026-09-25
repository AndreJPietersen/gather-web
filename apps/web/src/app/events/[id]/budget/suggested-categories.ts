import { createClient } from "@/lib/supabase/server";

export interface SuggestedCategory {
  id: string;
  name: string;
}

// Shared by the budget list page (for the "no budget items yet" empty
// state's tap target) and the dedicated Add Budget Item screen (for the
// suggestion chips themselves) — same cross-reference the Vendors page's
// "Suggested Vendors" section already does off event_type_service_categories
// (the admin-managed mapping of "which service categories are typically
// relevant to this event type"), here driving "which of those categories
// doesn't have a budget line yet" instead of "which vendors match." Every
// table involved has public SELECT RLS, so this runs fine on the plain
// request-scoped client.
export async function getSuggestedBudgetCategories(eventId: string, eventTypeId: string | null): Promise<SuggestedCategory[]> {
  if (!eventTypeId) return [];

  const supabase = await createClient();
  const [{ data: mappings }, { data: items }] = await Promise.all([
    supabase
      .from("event_type_service_categories")
      .select("service_categories!inner(id, name, is_active)")
      .eq("event_type_id", eventTypeId)
      .eq("service_categories.is_active", true)
      .returns<{ service_categories: SuggestedCategory | null }[]>(),
    supabase.from("budget_items").select("category_id").eq("event_id", eventId).returns<{ category_id: string | null }[]>(),
  ]);

  const usedCategoryIds = new Set((items ?? []).map((it) => it.category_id).filter((v): v is string => v !== null));
  return (mappings ?? [])
    .map((m) => m.service_categories)
    .filter((c): c is SuggestedCategory => c !== null && !usedCategoryIds.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}
