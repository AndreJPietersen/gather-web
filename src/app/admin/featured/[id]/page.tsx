import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { PlacementForm } from "../placement-form";

interface PlacementRow {
  id: string;
  vendor_id: string;
  status: "pending" | "activated" | "cancelled";
  starts_on: string;
  ends_on: string;
  position: number | null;
  fee_amount: string | null;
  note: string | null;
}

export default async function EditPlacementPage({ params }: PageProps<"/admin/featured/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const service = createServiceClient();

  const [{ data: placement }, { data: vendors }] = await Promise.all([
    service
      .from("vendor_feature_placements")
      .select("id, vendor_id, status, starts_on, ends_on, position, fee_amount, note")
      .eq("id", id)
      .maybeSingle<PlacementRow>(),
    service.from("vendors").select("id, name").order("name").returns<{ id: string; name: string }[]>(),
  ]);
  if (!placement) notFound();

  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <h1 className="font-display text-2xl font-semibold text-ink">Edit placement</h1>
      {placement.status === "cancelled" && (
        <p className="text-sm font-semibold text-text-muted">
          This placement is cancelled. Saving it here reopens it as pending (or activated, if you change the status).
        </p>
      )}
      <PlacementForm
        vendors={vendors ?? []}
        values={{
          placementId: placement.id,
          vendorId: placement.vendor_id,
          startsOn: placement.starts_on,
          endsOn: placement.ends_on,
          position: placement.position,
          status: placement.status === "cancelled" ? "pending" : placement.status,
          feeAmount: placement.fee_amount,
          note: placement.note,
        }}
      />
    </div>
  );
}
