import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewServiceCategoryForm } from "./new-service-category-form";
import { setServiceCategoryActive } from "./actions";

interface ServiceCategoryRow {
  id: string;
  name: string;
  is_active: boolean;
}

// The dropdown vendors see when tagging a service on their dashboard is
// driven entirely by this list (is_active = true, per that page's own
// query). Mapping which categories are relevant to which event type is
// managed from the Event Types side (see /admin/event-types/[id]), not
// here, so that editor isn't built twice.
export default async function AdminServiceCategoriesPage() {
  await requireAdmin();
  const service = createServiceClient();

  const { data: categories } = await service
    .from("service_categories")
    .select("id, name, is_active")
    .order("name")
    .returns<ServiceCategoryRow[]>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-ink">Service Categories</h1>
        <p className="text-sm font-semibold text-text-muted">
          Shown as a dropdown when a vendor adds a service on their dashboard. Link these to event types from the
          Event Types page to power Suggested Vendors.
        </p>
      </div>

      <NewServiceCategoryForm />

      <div className="flex flex-col gap-2">
        {categories && categories.length > 0 ? (
          categories.map((category) => (
            <Card key={category.id} className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-text">{category.name}</p>
                {!category.is_active && <p className="text-xs font-semibold text-text-muted">Inactive</p>}
              </div>
              <form action={setServiceCategoryActive}>
                <input type="hidden" name="id" value={category.id} />
                <input type="hidden" name="nextActive" value={(!category.is_active).toString()} />
                <Button type="submit" variant="secondary">
                  {category.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </form>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No service categories yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
