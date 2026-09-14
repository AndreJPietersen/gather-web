import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateTime, formatZAR } from "@/lib/utils";
import { getVendorAccess } from "../access";
import { SubmitQuoteForm } from "./submit-quote-form";
import { AddServiceForm } from "./add-service-form";
import { removeService } from "./actions";

interface BookingRow {
  id: string;
  status: string;
  confirmed: boolean;
  events: { name: string; start_at: string } | null;
  vendor_quotes: { id: string; amount: string; status: string }[];
}

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
}

export default async function VendorDashboardPage({ params }: PageProps<"/vendor/[vendorId]/dashboard">) {
  const { vendorId } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase.from("vendors").select("id, name").eq("id", vendorId).maybeSingle();
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

  // event_vendors_select_event_side_or_vendor_side's is_vendor_team_member
  // branch is a live join, not a snapshot — a teammate added after this
  // booking already existed still sees it here, the direct fix for the
  // documented Salesforce limitation.
  const { data: bookings } = await supabase
    .from("event_vendors")
    .select("id, status, confirmed, events(name, start_at), vendor_quotes(id, amount, status)")
    .eq("vendor_id", vendorId)
    .returns<BookingRow[]>();

  const { data: services } = await supabase
    .from("vendor_services")
    .select("id, name, description")
    .eq("vendor_id", vendorId)
    .returns<ServiceRow[]>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink">{vendor.name}</h1>
        <Link href={`/vendor/${vendorId}/team`} className="text-sm font-extrabold text-primary">
          Manage Team
        </Link>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Bookings</h2>
        <div className="mt-3 flex flex-col gap-2">
          {bookings && bookings.length > 0 ? (
            bookings.map((booking) => (
              <Card key={booking.id} className="flex flex-col gap-1">
                <p className="text-sm font-extrabold text-text">{booking.events?.name ?? "Event"}</p>
                {booking.events?.start_at && (
                  <p className="text-xs font-semibold text-text-muted">{formatEventDateTime(booking.events.start_at)}</p>
                )}
                {booking.vendor_quotes.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1">
                    {booking.vendor_quotes.map((quote) => (
                      <p key={quote.id} className="text-xs font-semibold text-text-muted">
                        Quote: {formatZAR(quote.amount)} · {quote.status}
                      </p>
                    ))}
                  </div>
                )}
                {canQuote && <SubmitQuoteForm eventVendorId={booking.id} vendorId={vendorId} />}
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No bookings yet.</p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Services</h2>
        <div className="mt-3 flex flex-col gap-2">
          {services && services.length > 0 ? (
            services.map((service) => (
              <Card key={service.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text">{service.name}</p>
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
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No services listed yet.</p>
            </Card>
          )}
        </div>
        {canQuote && (
          <div className="mt-3">
            <AddServiceForm vendorId={vendorId} />
          </div>
        )}
      </div>
    </main>
  );
}
