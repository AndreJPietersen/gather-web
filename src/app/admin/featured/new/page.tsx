import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { sastDayKey } from "@/lib/vendor-ranking";
import { PlacementForm } from "../placement-form";

export default async function NewPlacementPage({ searchParams }: PageProps<"/admin/featured/new">) {
  await requireAdmin();
  const { vendorId } = await searchParams;

  const service = createServiceClient();
  const { data: vendors } = await service.from("vendors").select("id, name").order("name").returns<{ id: string; name: string }[]>();

  const today = sastDayKey();
  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <h1 className="font-display text-2xl font-semibold text-ink">New featured placement</h1>
      <PlacementForm
        vendors={vendors ?? []}
        values={{ vendorId: typeof vendorId === "string" ? vendorId : undefined, startsOn: today }}
      />
    </div>
  );
}
