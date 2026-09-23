import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../../access";
import { AddInstallmentForm } from "../add-installment-form";

// Same "+ Add" pattern as /events/[id]/budget/add: the Payments page's
// header gets a top-right add action once a plan exists, and this is what
// it opens onto — AddInstallmentForm itself unchanged, just no longer
// sharing a scroll with the installment list and the plan summary above it.
export default async function AddInstallmentPage({
  params,
  searchParams,
}: PageProps<"/events/[id]/payments/add">) {
  const { id } = await params;
  const { vendor: vendorParam } = await searchParams;
  const eventVendorId = typeof vendorParam === "string" ? vendorParam : undefined;
  if (!eventVendorId) {
    redirect(`/events/${id}/payments`);
  }

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, owner_id, name").eq("id", id).maybeSingle();
  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);
  // Matches payment_installments' own INSERT policy (event owner/editor
  // only) — a Viewer-permission collaborator can load the plan (payment_
  // plans' SELECT policy is broader than this), but has no business landing
  // on an add screen they can't actually submit against.
  if (!access.isEditor) {
    notFound();
  }

  const { data: eventVendor } = await supabase
    .from("event_vendors")
    .select("id, vendors(name)")
    .eq("id", eventVendorId)
    .eq("event_id", event.id)
    .maybeSingle<{ id: string; vendors: { name: string } | null }>();
  if (!eventVendor) {
    notFound();
  }

  const { data: plan } = await supabase
    .from("payment_plans")
    .select("id")
    .eq("event_vendor_id", eventVendor.id)
    .maybeSingle<{ id: string }>();
  // Nothing to add an installment to yet — back to the main Payments page,
  // which is what renders CreatePlanForm for this vendor.
  if (!plan) {
    redirect(`/events/${event.id}/payments?vendor=${eventVendor.id}`);
  }

  const { count } = await supabase
    .from("payment_installments")
    .select("id", { count: "exact", head: true })
    .eq("payment_plan_id", plan.id);
  const nextInstallmentNumber = (count ?? 0) + 1;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Add Installment">
        <p className="text-sm font-semibold text-text-muted">{eventVendor.vendors?.name ?? "Vendor"}</p>
      </PageHeader>

      <AddInstallmentForm
        paymentPlanId={plan.id}
        eventId={event.id}
        eventVendorId={eventVendor.id}
        nextInstallmentNumber={nextInstallmentNumber}
      />
    </main>
  );
}
