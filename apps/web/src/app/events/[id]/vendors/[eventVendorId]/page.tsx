import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatZAR } from "@/lib/utils";
import { getEventAccess } from "../../access";
import { declineQuote, setVendorConfirmed } from "./actions";
import { AcceptQuoteForm } from "./accept-quote-form";
import { RemoveVendorForm } from "./remove-vendor-form";

interface QuoteRow {
  id: string;
  amount: string;
  description: string | null;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  valid_until: string | null;
}

interface PlanRow {
  id: string;
  total_amount: string;
  budget_item_id: string | null;
  payment_installments: { amount: string; status: string }[];
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

  const acceptedQuote = (quotes ?? []).find((q) => q.status === "accepted") ?? null;

  // Shown inline now, not just reachable through the "Manage Payments"
  // button — Andre's own feedback: this page already lists quotes inline,
  // payments should read the same way instead of being a dead-end link.
  const { data: plan } = await supabase
    .from("payment_plans")
    .select("id, total_amount, budget_item_id, payment_installments(amount, status)")
    .eq("event_vendor_id", eventVendor.id)
    .maybeSingle<PlanRow>();

  const paid = plan ? plan.payment_installments.filter((i) => i.status === "paid").reduce((sum, i) => sum + Number(i.amount), 0) : 0;
  const planTotal = plan ? Number(plan.total_amount) : 0;
  // Flags the exact confusion Andre hit: an accepted quote and the payment
  // plan's own total are two independently-entered numbers with nothing in
  // the schema keeping them in sync (payment_plans.total_amount is
  // hand-typed when the plan is created, same as budget_items.
  // committed_amount is on the Budget page) — surfaced here as a plain
  // warning rather than silently letting the two disagree.
  const quoteMismatch =
    acceptedQuote && plan && Math.abs(Number(acceptedQuote.amount) - planTotal) > 0.01 ? Number(acceptedQuote.amount) : null;

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
      <PageHeader
        title={eventVendor.vendors?.name ?? "Vendor"}
        action={
          access.isEditor ? (
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
          )
        }
      >
        <p className="text-sm font-semibold text-text-muted">Status: {eventVendor.status}</p>
      </PageHeader>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/events/${event.id}/vendors/${eventVendor.id}/chat`}
          className="rounded-pill border-2 border-border bg-surface px-4 py-2.5 text-center text-xs font-extrabold text-text"
        >
          Chat
        </Link>
        <Link
          href={`/events/${event.id}/payments?vendor=${eventVendor.id}`}
          className="rounded-pill border-2 border-border bg-surface px-4 py-2.5 text-center text-xs font-extrabold text-text"
        >
          Manage Payments
        </Link>
      </div>

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

      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Payments</h2>
          {plan && (
            <Link href={`/events/${event.id}/payments?vendor=${eventVendor.id}`} className="text-xs font-extrabold text-primary">
              View installments
            </Link>
          )}
        </div>
        <div className="mt-3">
          {plan ? (
            <Card className="flex flex-col gap-2">
              {quoteMismatch !== null && (
                <p className="text-xs font-semibold text-primary">
                  Heads up — the accepted quote was {formatZAR(quoteMismatch)}, but this payment plan totals{" "}
                  {formatZAR(planTotal)}. The plan&apos;s total is what actually counts toward the budget.
                </p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-text">Total</p>
                <p className="text-sm font-extrabold text-text">{formatZAR(planTotal)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-text">Paid</p>
                <p className="text-sm font-extrabold text-success">{formatZAR(paid)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-text">Outstanding</p>
                <p className="text-sm font-extrabold text-primary">{formatZAR(planTotal - paid)}</p>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">
                {access.isEditor ? (
                  <>
                    No payment plan yet.{" "}
                    <Link href={`/events/${event.id}/payments?vendor=${eventVendor.id}`} className="text-primary underline">
                      Create one
                    </Link>
                  </>
                ) : (
                  "No payment plan yet."
                )}
              </p>
            </Card>
          )}
        </div>
      </div>

      {access.isEditor && <RemoveVendorForm eventId={event.id} eventVendorId={eventVendor.id} />}
    </main>
  );
}
