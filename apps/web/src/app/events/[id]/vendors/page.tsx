import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, LinkCard } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../access";
import { associateWithEvent } from "@/app/vendors/[id]/actions";
import { ChatUnreadBadge } from "./[eventVendorId]/chat/unread-badge";
import { getUnreadCounts } from "./[eventVendorId]/chat/actions";
import { getSuggestedVendorsForEvent } from "@/lib/vendor-suggestions";

interface EventVendorRow {
  id: string;
  status: "interested" | "shortlisted" | "contracted" | "rejected";
  confirmed: boolean;
  amount: string | null;
  vendor_id: string;
  vendors: { name: string } | null;
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

  // Excludes 'rejected' — that status is now what removeVendorFromEvent
  // sets (a soft-remove, since event_vendors has no DELETE policy to
  // actually cascade-wipe its payment/chat history). This filter is what
  // makes "remove" actually read as "gone from the list" rather than just
  // a status flag nobody sees change; a removed booking is still directly
  // reachable at its own detail/chat/payments URLs, just not surfaced here.
  const { data: eventVendors } = await supabase
    .from("event_vendors")
    .select("id, status, confirmed, amount, vendor_id, vendors(name)")
    .eq("event_id", event.id)
    .neq("status", "rejected")
    .returns<EventVendorRow[]>();

  const unreadByThread = await getUnreadCounts((eventVendors ?? []).map((ev) => ev.id));

  // Cross-references this event's type against the admin-managed mapping
  // (event_type_service_categories) to find vendors whose own services are
  // tagged with a relevant category — e.g. a Wedding is mapped to Music,
  // Catering, Photography, so a vendor with any service in one of those
  // categories gets suggested. Every table here has public SELECT RLS, so
  // this runs on the plain request-scoped client, no service role needed.
  const suggestedVendors =
    access.isEditor && event.event_type_id
      ? await getSuggestedVendorsForEvent(supabase, {
          eventTypeId: event.event_type_id,
          excludeVendorIds: (eventVendors ?? []).map((ev) => ev.vendor_id),
          limit: 8,
        })
      : [];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Vendors">
        <p className="text-sm font-semibold text-text-muted">{event.name}</p>
      </PageHeader>

      <StaggerList className="flex flex-col gap-2">
        {eventVendors && eventVendors.length > 0 ? (
          eventVendors.map((ev) => (
            <StaggerItem key={ev.id}>
              <LinkCard href={`/events/${event.id}/vendors/${ev.id}`} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text">{ev.vendors?.name ?? "Vendor"}</p>
                  {ev.confirmed && <p className="text-xs font-semibold text-success">Confirmed</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {unreadByThread[ev.id] > 0 && <ChatUnreadBadge count={unreadByThread[ev.id]} />}
                  <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusLabelClasses[ev.status]}`}>
                    {ev.status}
                  </span>
                </div>
              </LinkCard>
            </StaggerItem>
          ))
        ) : access.isEditor ? (
          <LinkCard href="/vendors">
            <p className="text-sm font-semibold text-text-muted">No vendors associated with this event yet — tap to browse vendors.</p>
          </LinkCard>
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No vendors associated with this event yet.</p>
          </Card>
        )}
      </StaggerList>

      {suggestedVendors.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Suggested Vendors</h2>
          <p className="text-xs font-semibold text-text-muted">Based on this event&apos;s type.</p>
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
