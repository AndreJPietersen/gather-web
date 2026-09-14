import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../access";

interface EventVendorRow {
  id: string;
  status: "interested" | "shortlisted" | "contracted" | "rejected";
  confirmed: boolean;
  amount: string | null;
  vendors: { name: string } | null;
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

  const { data: event } = await supabase.from("events").select("id, owner_id, name").eq("id", id).maybeSingle();
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
    .select("id, status, confirmed, amount, vendors(name)")
    .eq("event_id", event.id)
    .returns<EventVendorRow[]>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Vendors</h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">{event.name}</p>
      </div>

      <div className="flex flex-col gap-2">
        {eventVendors && eventVendors.length > 0 ? (
          eventVendors.map((ev) => (
            <Link key={ev.id} href={`/events/${event.id}/vendors/${ev.id}`}>
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text">{ev.vendors?.name ?? "Vendor"}</p>
                  {ev.confirmed && <p className="text-xs font-semibold text-success">Confirmed</p>}
                </div>
                <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusLabelClasses[ev.status]}`}>
                  {ev.status}
                </span>
              </Card>
            </Link>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">
              No vendors associated with this event yet — add one from the vendor directory.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}
