import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { getVendorAccess } from "../../access";
import { AddServiceForm } from "../add-service-form";
import { removeService } from "../actions";

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  service_categories: { name: string } | null;
}

export default async function VendorServicesPage({ params }: PageProps<"/vendor/[vendorId]/dashboard/services">) {
  const { vendorId } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase.from("vendors").select("id, name").eq("id", vendorId).maybeSingle<{ id: string; name: string }>();
  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getVendorAccess(vendorId, user?.id ?? null);
  if (!access.isTeamMember) {
    notFound();
  }
  const canQuote = access.role === "owner" || access.role === "manager";

  const [{ data: services }, { data: serviceCategories }] = await Promise.all([
    supabase
      .from("vendor_services")
      .select("id, name, description, category_id, service_categories(name)")
      .eq("vendor_id", vendorId)
      .returns<ServiceRow[]>(),
    supabase.from("service_categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Services">
        <p className="text-sm font-semibold text-text-muted">{vendor.name}</p>
      </PageHeader>

      <StaggerList className="flex flex-col gap-2">
        {services && services.length > 0 ? (
          services.map((service) => (
            <StaggerItem key={service.id}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text">{service.name}</p>
                  <p className="text-xs font-semibold text-text-muted">{service.service_categories?.name ?? "Uncategorized"}</p>
                  {service.description && <p className="text-xs font-semibold text-text-muted">{service.description}</p>}
                </div>
                {canQuote && (
                  <form action={removeService}>
                    <input type="hidden" name="serviceId" value={service.id} />
                    <input type="hidden" name="vendorId" value={vendorId} />
                    <button type="submit" className="text-xs font-extrabold text-primary">
                      Remove
                    </button>
                  </form>
                )}
              </Card>
            </StaggerItem>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No services listed yet.</p>
          </Card>
        )}
      </StaggerList>
      {canQuote && <AddServiceForm vendorId={vendorId} categories={serviceCategories ?? []} />}
    </main>
  );
}
