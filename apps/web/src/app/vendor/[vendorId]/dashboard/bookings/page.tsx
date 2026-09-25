import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateTime, formatZAR } from "@gather/shared/utils";
import { getVendorAccess } from "../../access";
import { SubmitQuoteForm } from "../submit-quote-form";
import { discardSuggestedQuote, sendSuggestedQuote } from "../actions";
import { BookingNoteForm } from "./booking-note-form";
import { ChatUnreadBadge } from "@/app/events/[id]/vendors/[eventVendorId]/chat/unread-badge";
import { getUnreadCounts } from "@/app/events/[id]/vendors/[eventVendorId]/chat/actions";

interface BookingRow {
  id: string;
  status: string;
  confirmed: boolean;
  events: { name: string; start_at: string; owner: { display_name: string | null } | null } | null;
  vendor_quotes: {
    id: string;
    amount: string;
    status: string;
    suggested_by: string | null;
    suggester: { display_name: string | null } | null;
  }[];
}

interface NoteRow {
  event_vendor_id: string;
  body: string;
  editor: { display_name: string | null } | null;
}

// Split out of the dashboard's single long page (Andre: "it's getting long
// and cluttered") into its own screen, reached from the dashboard's launch
// grid — same content and actions as before, just no longer sharing a
// scroll with every other section.
export default async function VendorBookingsPage({ params }: PageProps<"/vendor/[vendorId]/dashboard/bookings">) {
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
  // Owner/Manager send quotes and approve Staff suggestions; Staff suggest.
  // What each role can *see* is decided by the database: Staff only get
  // back their own suggestions from vendor_quotes, never sent prices.
  const canQuote = access.role === "owner" || access.role === "manager";

  // event_vendors_select_event_side_or_vendor_side's is_vendor_team_member
  // branch is a live join, not a snapshot — a teammate added after this
  // booking already existed still sees it here, the direct fix for the
  // documented Salesforce limitation.
  const { data: bookings } = await supabase
    .from("event_vendors")
    .select(
      "id, status, confirmed, events(name, start_at, owner:profiles!events_owner_id_profiles_id_fk(display_name)), vendor_quotes(id, amount, status, suggested_by, suggester:profiles!vendor_quotes_suggested_by_profiles_id_fk(display_name))",
    )
    .eq("vendor_id", vendorId)
    .returns<BookingRow[]>();

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const [unreadByThread, { data: notes }] = await Promise.all([
    getUnreadCounts(bookingIds),
    bookingIds.length > 0
      ? supabase
          .from("vendor_booking_notes")
          .select("event_vendor_id, body, editor:profiles!vendor_booking_notes_updated_by_profiles_id_fk(display_name)")
          .in("event_vendor_id", bookingIds)
          .returns<NoteRow[]>()
      : Promise.resolve({ data: [] as NoteRow[] }),
  ]);
  const noteByBooking = new Map((notes ?? []).map((n) => [n.event_vendor_id, n]));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Bookings">
        <p className="text-sm font-semibold text-text-muted">{vendor.name}</p>
      </PageHeader>

      <StaggerList className="flex flex-col gap-2">
        {bookings && bookings.length > 0 ? (
          bookings.map((booking) => (
            <StaggerItem key={booking.id}>
              <Card className="flex flex-col gap-1">
                <p className="text-sm font-extrabold text-text">
                  {booking.events?.owner?.display_name ?? "Planner"} · {booking.events?.name ?? "Event"}
                </p>
                {booking.events?.start_at && (
                  <p className="text-xs font-semibold text-text-muted">{formatEventDateTime(booking.events.start_at)}</p>
                )}
                {booking.vendor_quotes.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1">
                    {booking.vendor_quotes.map((quote) =>
                      quote.status === "draft" ? (
                        <div key={quote.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-field bg-secondary-soft px-2.5 py-1.5">
                          <p className="text-xs font-bold text-ink">
                            {canQuote
                              ? `Suggested by ${quote.suggester?.display_name ?? "a teammate"}: ${formatZAR(quote.amount)}`
                              : `Your suggestion: ${formatZAR(quote.amount)} · waiting for a Manager`}
                          </p>
                          {canQuote && (
                            <form action={sendSuggestedQuote}>
                              <input type="hidden" name="quoteId" value={quote.id} />
                              <input type="hidden" name="vendorId" value={vendorId} />
                              <button type="submit" className="text-xs font-extrabold text-primary">
                                Send to planner
                              </button>
                            </form>
                          )}
                          <form action={discardSuggestedQuote}>
                            <input type="hidden" name="quoteId" value={quote.id} />
                            <input type="hidden" name="vendorId" value={vendorId} />
                            <button type="submit" className="text-xs font-extrabold text-text-muted">
                              {canQuote ? "Discard" : "Withdraw"}
                            </button>
                          </form>
                        </div>
                      ) : (
                        <p key={quote.id} className="text-xs font-semibold text-text-muted">
                          Quote: {formatZAR(quote.amount)} · {quote.status}
                        </p>
                      ),
                    )}
                  </div>
                )}
                <Link
                  href={`/vendor/${vendorId}/bookings/${booking.id}/chat`}
                  className="mt-1 flex w-fit items-center gap-2 text-xs font-extrabold text-primary"
                >
                  Chat
                  {unreadByThread[booking.id] > 0 && <ChatUnreadBadge count={unreadByThread[booking.id]} size="md" />}
                </Link>
                <SubmitQuoteForm eventVendorId={booking.id} vendorId={vendorId} isSuggestion={!canQuote} />
                <BookingNoteForm
                  eventVendorId={booking.id}
                  vendorId={vendorId}
                  body={noteByBooking.get(booking.id)?.body ?? ""}
                  lastEditedBy={noteByBooking.get(booking.id)?.editor?.display_name ?? null}
                />
              </Card>
            </StaggerItem>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No bookings yet.</p>
          </Card>
        )}
      </StaggerList>
    </main>
  );
}
