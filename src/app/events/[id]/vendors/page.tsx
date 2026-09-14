import { notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { Card, LinkCard } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../access";
import { associateWithEvent } from "@/app/vendors/[id]/actions";

interface EventVendorRow {
  id: string;
  status: "interested" | "shortlisted" | "contracted" | "rejected";
  confirmed: boolean;
  amount: string | null;
  vendor_id: string;
  vendors: { name: string } | null;
}

interface SuggestedVendor {
  id: string;
  name: string;
  primary_category: string | null;
}

// A plain <form action> must return void|Promise<void>, but
// associateWithEvent (built for useActionState) returns {error?}. This
// inline Server Action just discards that return value — the error case is
// a rare edge on a page whose access is already verified, the same
// tradeoff this codebase's other fire-and-forget admin actions
// (approveClaim/rejectClaim) already accept for equivalent "quick action,
// no inline error UI" buttons.
async function addSuggestedVendor(formData: FormData): Promise<void> {
  "use server";
  await associateWithEvent({}, formData);
}

const statusLabelClasses: Record<EventVendorRow["status"], string> = {
  interested: "bg-secondary-soft text-ink",
  shortlisted: "bg-primary-soft text-primary",
  contracted: "bg-success-soft text-ink",
  rejected: "bg-surface text-text-muted border-2 border-border",
};

export default async function EventVendorsPage({ params }: PageProps<"/events/[id]/vendors">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, owner_id, name, event_type_id").eq("id", id).maybeSingle();
  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);
  if (!access.isOwner && !access.isCollaborator) {
    notFound();
  }

  const { data: eventVendors } = await supabase
    .from("event_vendors")
    .select("id, status, confirmed, amount, vendor_id, vendors(name)")
    .eq("event_id", event.id)
    .returns<EventVendorRow[]>();

  // Cross-references this event's type against the admin-managed mapping
  // (event_type_service_categories) to find vendors whose own services are
  // tagged with a relevant category — e.g. a Wedding is mapped to Music,
  // Catering, Photography, so a vendor with any service in one of those
  // categories gets suggested. Every table here has public SELECT RLS, so
  // this runs on the plain request-scoped client, no service role needed.
  let suggestedVendors: SuggestedVendor[] = [];
  if (access.isEditor && event.event_type_id) {
    const { data: mappings } = await supabase
      .from("event_type_service_categories")
      .select("service_category_id, service_categories!inner(is_active)")
      .eq("event_type_id", event.event_type_id)
      .eq("service_categories.is_active", true);
    const categoryIds = (mappings ?? []).map((m) => m.service_category_id);

    if (categoryIds.length > 0) {
      const excluded = new Set((eventVendors ?? []).map((ev) => ev.vendor_id));
      const { data: matches } = await supabase
        .from("vendor_services")
        .select("vendor_id, vendors(id, name, primary_category)")
        .in("category_id", categoryIds)
        .limit(24)
        .returns<{ vendor_id: string; vendors: SuggestedVendor | null }[]>();

      for (const match of matches ?? []) {
        if (!match.vendors || excluded.has(match.vendor_id)) continue;
        excluded.add(match.vendor_id);
        suggestedVendors.push(match.vendors);
        if (suggestedVendors.length >= 8) break;
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <BackButton />
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Vendors</h1>
          <p className="mt-1 text-sm font-semibold text-text-muted">{event.name}</p>
        </div>
      </div>

      <StaggerList className="flex flex-col gap-2">
        {eventVendors && eventVendors.length > 0 ? (
          eventVendors.map((ev) => (
            <StaggerItem key={ev.id}>
              <LinkCard href={`/events/${event.id}/vendors/${ev.id}`} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text">{ev.vendors?.name ?? "Vendor"}</p>
                  {ev.confirmed && <p className="text-xs font-semibold text-success">Confirmed</p>}
                </div>
                <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusLabelClasses[ev.status]}`}>
                  {ev.status}
                </span>
              </LinkCard>
            </StaggerItem>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No vendors associated with this event yet.</p>
          </Card>
        )}
      </StaggerList>

      {suggestedVendors.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Suggested Vendors</h2>
          <p className="text-xs font-semibold text-text-muted">Based on this event's type.</p>
          <StaggerList className="mt-3 flex flex-col gap-2">
            {suggestedVendors.map((vendor) => (
              <StaggerItem key={vendor.id}>
                <Card className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-text">{vendor.name}</p>
                    {vendor.primary_category && <p className="text-xs font-semibold text-text-muted">{vendor.primary_category}</p>}
                  </div>
                  <form action={addSuggestedVendor}>
                    <input type="hidden" name="vendorId" value={vendor.id} />
                    <input type="hidden" name="eventId" value={event.id} />
                    <Button type="submit" variant="secondary">
                      Add
                    </Button>
                  </form>
                </Card>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}

      {access.isEditor && (
        <LinkButton href="/vendors" variant="secondary">
          Browse all vendors
        </LinkButton>
      )}
    </main>
  );
}
