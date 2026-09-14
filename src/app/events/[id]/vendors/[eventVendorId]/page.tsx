import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatZAR } from "@/lib/utils";
import { getEventAccess } from "../../access";
import { declineQuote, setVendorConfirmed } from "./actions";
import { AcceptQuoteForm } from "./accept-quote-form";

interface QuoteRow {
  id: string;
  amount: string;
  description: string | null;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  valid_until: string | null;
}

const quoteStatusClasses: Record<QuoteRow["status"], string> = {
  draft: "bg-surface text-text-muted border-2 border-border",
  sent: "bg-secondary-soft text-ink",
  accepted: "bg-success-soft text-ink",
  declined: "bg-primary-soft text-primary",
  expired: "bg-surface text-text-muted border-2 border-border",
};

export default async function EventVendorDetailPage({ params }: PageProps<"/events/[id]/vendors/[eventVendorId]">) {
  const { id, eventVendorId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, owner_id").eq("id", id).maybeSingle();
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

  const { data: eventVendor } = await supabase
    .from("event_vendors")
    .select("id, status, confirmed, vendors(name)")
    .eq("id", eventVendorId)
    .eq("event_id", event.id)
    .maybeSingle<{ id: string; status: string; confirmed: boolean; vendors: { name: string } | null }>();

  if (!eventVendor) {
    notFound();
  }

  const { data: quotes } = await supabase
    .from("vendor_quotes")
    .select("id, amount, description, status, valid_until")
    .eq("event_vendor_id", eventVendor.id)
    .order("created_at", { ascending: false })
    .returns<QuoteRow[]>();

  // A vendor booking can be linked from more than one budget line (e.g. one
  // all-in-one vendor covering two service lines) — surfaced here since
  // this page previously gave no indication a budget item pointed back at
  // this exact booking at all.
  const { data: linkedBudgetItems } = await supabase
    .from("budget_items")
    .select("id, label")
    .eq("event_vendor_id", eventVendor.id)
    .returns<{ id: string; label: string }[]>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <BackButton />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">{eventVendor.vendors?.name ?? "Vendor"}</h1>
            <p className="mt-1 text-sm font-semibold text-text-muted">Status: {eventVendor.status}</p>
          </div>
          {access.isEditor ? (
            <form action={setVendorConfirmed}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="eventVendorId" value={eventVendor.id} />
              <input type="hidden" name="confirmed" value={(!eventVendor.confirmed).toString()} />
              <button
                type="submit"
                className={`rounded-pill px-3 py-1.5 text-xs font-extrabold uppercase ${
                  eventVendor.confirmed ? "bg-success-soft text-ink" : "border-2 border-border bg-surface text-text-muted"
                }`}
              >
                {eventVendor.confirmed ? "Confirmed" : "Pending"}
              </button>
            </form>
          ) : (
            <span
              className={`rounded-pill px-3 py-1.5 text-xs font-extrabold uppercase ${
                eventVendor.confirmed ? "bg-success-soft text-ink" : "border-2 border-border bg-surface text-text-muted"
              }`}
            >
              {eventVendor.confirmed ? "Confirmed" : "Pending"}
            </span>
          )}
        </div>
      </div>

      <Link
        href={`/events/${event.id}/payments?vendor=${eventVendor.id}`}
        className="rounded-pill border-2 border-border bg-surface px-4 py-2.5 text-center text-xs font-extrabold text-text"
      >
        Manage Payments
      </Link>

      {linkedBudgetItems && linkedBudgetItems.length > 0 && (
        <Card className="flex flex-col gap-1">
          <p className="text-xs font-extrabold uppercase text-text-muted">Linked budget line{linkedBudgetItems.length > 1 ? "s" : ""}</p>
          {linkedBudgetItems.map((item) => (
            <Link key={item.id} href={`/events/${event.id}/budget`} className="text-sm font-bold text-text">
              {item.label}
            </Link>
          ))}
        </Card>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Quotes</h2>
        <StaggerList className="mt-3 flex flex-col gap-2">
          {quotes && quotes.length > 0 ? (
            quotes.map((quote) => (
              <StaggerItem key={quote.id}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold text-text">{formatZAR(quote.amount)}</p>
                    <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${quoteStatusClasses[quote.status]}`}>
                      {quote.status}
                    </span>
                  </div>
                  {quote.description && <p className="text-sm font-semibold text-text-muted">{quote.description}</p>}
                  {access.isEditor && quote.status === "sent" && (
                    <div className="flex gap-2">
                      <AcceptQuoteForm quoteId={quote.id} eventId={event.id} eventVendorId={eventVendor.id} />
                      <form action={declineQuote} className="flex-1">
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="eventVendorId" value={eventVendor.id} />
                        <Button type="submit" variant="secondary" className="w-full">
                          Decline
                        </Button>
                      </form>
                    </div>
                  )}
                </Card>
              </StaggerItem>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No quotes yet.</p>
            </Card>
          )}
        </StaggerList>
      </div>
    </main>
  );
}
