import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { linkServiceCategory, unlinkServiceCategory } from "./actions";

interface ServiceCategoryRow {
  id: string;
  name: string;
  is_active: boolean;
}

// The mapping editor behind "Suggested Vendors": which service categories
// are relevant to this event type. Lists every category, active and
// inactive alike (an inactive one might still be linked from before it was
// deactivated — showing it lets an admin actually unlink it rather than it
// silently going stale and unreachable).
export default async function AdminEventTypeDetailPage({ params }: PageProps<"/admin/event-types/[id]">) {
  const { id } = await params;
  await requireAdmin();
  const service = createServiceClient();

  const { data: eventType } = await service.from("event_types").select("id, name, is_active").eq("id", id).maybeSingle();
  if (!eventType) {
    notFound();
  }

  const [{ data: categories }, { data: mappings }] = await Promise.all([
    service.from("service_categories").select("id, name, is_active").order("name").returns<ServiceCategoryRow[]>(),
    service.from("event_type_service_categories").select("service_category_id").eq("event_type_id", id),
  ]);

  const linkedIds = new Set((mappings ?? []).map((m) => m.service_category_id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-ink">{eventType.name}</h1>
        <p className="text-sm font-semibold text-text-muted">
          Service categories linked here are what "Suggested Vendors" matches against on events of this type.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {categories && categories.length > 0 ? (
          categories.map((category) => {
            const linked = linkedIds.has(category.id);
            return (
              <Card key={category.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-text">{category.name}</p>
                  {!category.is_active && <p className="text-xs font-semibold text-text-muted">Inactive</p>}
                </div>
                <form action={linked ? unlinkServiceCategory : linkServiceCategory}>
                  <input type="hidden" name="eventTypeId" value={eventType.id} />
                  <input type="hidden" name="serviceCategoryId" value={category.id} />
                  <Button type="submit" variant={linked ? "secondary" : "primary"}>
                    {linked ? "Unlink" : "Link"}
                  </Button>
                </form>
              </Card>
            );
          })
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No service categories yet — add one first.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
