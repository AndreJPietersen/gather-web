import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, LinkCard } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatZAR } from "@/lib/utils";
import { isInstallmentOverdue } from "@/lib/upcoming";
import { getEventAccess } from "../access";
import { CreatePlanForm } from "./create-plan-form";
import { ProofOfPaymentForm } from "./proof-of-payment-form";
import { activatePlan, markInstallmentPaid, markInstallmentRefunded, setPlanBudgetItem } from "./actions";

const PROOF_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — regenerated on every page load anyway

interface EventVendorOption {
  id: string;
  vendors: { name: string } | null;
}

interface PaymentPlanRow {
  id: string;
  total_amount: string;
  deposit_amount: string | null;
  status: "draft" | "active" | "completed" | "cancelled";
  budget_item_id: string | null;
}

interface InstallmentRow {
  id: string;
  installment_number: number;
  due_date: string;
  amount: string;
  status: "pending" | "paid" | "late" | "cancelled" | "refunded";
  proof_of_payment_path: string | null;
}

export default async function EventPaymentsPage({
  params,
  searchParams,
}: PageProps<"/events/[id]/payments">) {
  const { id } = await params;
  const { vendor: vendorParam, budgetItem: budgetItemParam } = await searchParams;
  const eventVendorId = typeof vendorParam === "string" ? vendorParam : undefined;
  const defaultBudgetItemId = typeof budgetItemParam === "string" ? budgetItemParam : undefined;

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

  if (!eventVendorId) {
    // Excludes 'rejected' — same filter the Vendors list page applies, for
    // the same reason: without it, a removed booking's event_vendors row
    // (soft-removed, never actually deleted — see removeVendorFromEvent)
    // stays picker-visible forever, showing as a confusing duplicate entry
    // if the same vendor was ever removed and re-added to this event.
    const { data: eventVendors } = await supabase
      .from("event_vendors")
      .select("id, vendors(name)")
      .eq("event_id", event.id)
      .neq("status", "rejected")
      .returns<EventVendorOption[]>();

    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
        <PageHeader title="Payments">
          <p className="text-sm font-semibold text-text-muted">
            A plan you set up and maintain yourself, organized by vendor — pick one to create or manage it.
          </p>
        </PageHeader>
        <StaggerList className="flex flex-col gap-2">
          {eventVendors && eventVendors.length > 0 ? (
            eventVendors.map((ev) => (
              <StaggerItem key={ev.id}>
                <LinkCard href={`/events/${event.id}/payments?vendor=${ev.id}`}>
                  <p className="text-sm font-bold text-text">{ev.vendors?.name ?? "Vendor"}</p>
                </LinkCard>
              </StaggerItem>
            ))
          ) : (
            <Card className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-text-muted">
                Payment plans are tracked per vendor. Add a vendor to this event first, then come back here to set up
                a plan.
              </p>
              <LinkButton href="/vendors" variant="secondary">
                Browse vendors
              </LinkButton>
            </Card>
          )}
        </StaggerList>
      </main>
    );
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
    .select("id, total_amount, deposit_amount, status, budget_item_id")
    .eq("event_vendor_id", eventVendor.id)
    .maybeSingle<PaymentPlanRow>();

  // Only ever needed for the "create a plan" form below — once a plan
  // exists its own total is the number that matters (see the vendor detail
  // page and the Budget page for the mismatch warning that shows if they
  // ever disagree). Prefilling from the accepted quote here is the actual
  // fix: it's still just a default, not locked, since a planner may have
  // genuinely negotiated a different final price after the quote.
  let acceptedQuoteAmount: number | null = null;
  if (!plan) {
    const { data: acceptedQuote } = await supabase
      .from("vendor_quotes")
      .select("amount")
      .eq("event_vendor_id", eventVendor.id)
      .eq("status", "accepted")
      .maybeSingle<{ amount: string }>();
    acceptedQuoteAmount = acceptedQuote ? Number(acceptedQuote.amount) : null;
  }

  // Fetched regardless of whether a plan already exists — needed either
  // for CreatePlanForm's own optional field, or for the "attach to a
  // budget item" control shown below on an existing (possibly untagged)
  // plan.
  const { data: budgetItems } = await supabase
    .from("budget_items")
    .select("id, label")
    .eq("event_id", event.id)
    .order("created_at");

  const { data: installments } = plan
    ? await supabase
        .from("payment_installments")
        .select("id, installment_number, due_date, amount, status, proof_of_payment_path")
        .eq("payment_plan_id", plan.id)
        .order("installment_number", { ascending: true })
        .returns<InstallmentRow[]>()
    : { data: [] as InstallmentRow[] };

  const installmentsWithProofUrls = await Promise.all(
    (installments ?? []).map(async (installment) => {
      if (!installment.proof_of_payment_path) return { ...installment, proofUrl: null };
      const { data } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(installment.proof_of_payment_path, PROOF_SIGNED_URL_TTL_SECONDS);
      return { ...installment, proofUrl: data?.signedUrl ?? null };
    }),
  );

  const paid = (installments ?? [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const total = plan ? Number(plan.total_amount) : 0;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader
        title="Payments"
        action={
          plan &&
          access.isEditor && (
            <Link
              href={`/events/${event.id}/payments/add?vendor=${eventVendor.id}`}
              className="rounded-pill bg-primary px-4 py-2 text-xs font-extrabold text-white"
            >
              + Add
            </Link>
          )
        }
      >
        <p className="text-sm font-semibold text-text-muted">{eventVendor.vendors?.name ?? "Vendor"}</p>
      </PageHeader>

      {!plan ? (
        access.isEditor ? (
          <div>
            <p className="text-sm font-semibold text-text-muted">
              This plan is yours to set up and track — {eventVendor.vendors?.name ?? "the vendor"} won&apos;t see or
              edit it.
            </p>
            <div className="mt-3">
              <CreatePlanForm
                eventVendorId={eventVendor.id}
                eventId={event.id}
                budgetItems={budgetItems ?? []}
                defaultBudgetItemId={defaultBudgetItemId}
                acceptedQuoteAmount={acceptedQuoteAmount}
              />
            </div>
          </div>
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No payment plan set up yet.</p>
          </Card>
        )
      ) : (
        <>
          <Card className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-text">Total</p>
              <p className="text-sm font-extrabold text-text">{formatZAR(total)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-text">Paid</p>
              <p className="text-sm font-extrabold text-success">{formatZAR(paid)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-text">Outstanding</p>
              <p className="text-sm font-extrabold text-primary">{formatZAR(total - paid)}</p>
            </div>
            {plan.status === "draft" && access.isEditor && (
              <form action={activatePlan} className="mt-2">
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="eventId" value={event.id} />
                <Button type="submit" variant="secondary" className="w-full">
                  Activate Plan
                </Button>
              </form>
            )}
          </Card>

          {access.isEditor && budgetItems && budgetItems.length > 0 && (
            <form action={setPlanBudgetItem} className="flex flex-col gap-1.5">
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="eventId" value={event.id} />
              <span className="text-xs font-extrabold text-text-muted">
                Budget line — which budget item this plan counts against
              </span>
              <div className="flex items-center gap-2">
                <select
                  name="budgetItemId"
                  defaultValue={plan.budget_item_id ?? ""}
                  className="min-w-0 flex-1 rounded-field border-2 border-border bg-surface px-3 py-2 text-xs font-bold text-text"
                >
                  <option value="">Not attached to a budget line</option>
                  {budgetItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="secondary" className="px-4 py-2 text-xs">
                  Save
                </Button>
              </div>
            </form>
          )}

          <StaggerList className="flex flex-col gap-2">
            {installmentsWithProofUrls.length === 0 &&
              (access.isEditor ? (
                <LinkCard href={`/events/${event.id}/payments/add?vendor=${eventVendor.id}`}>
                  <p className="text-sm font-semibold text-text-muted">No installments yet — tap to add one.</p>
                </LinkCard>
              ) : (
                <Card>
                  <p className="text-sm font-semibold text-text-muted">No installments yet.</p>
                </Card>
              ))}
            {installmentsWithProofUrls.map((installment) => (
              <StaggerItem key={installment.id}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-text">
                        #{installment.installment_number} · {formatZAR(installment.amount)}
                      </p>
                      <p
                        className={`text-xs font-semibold ${isInstallmentOverdue(installment.status, installment.due_date) ? "text-primary" : "text-text-muted"}`}
                      >
                        {isInstallmentOverdue(installment.status, installment.due_date) ? "Overdue · " : ""}Due{" "}
                        {installment.due_date}
                      </p>
                    </div>
                    {installment.status === "paid" ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-pill bg-success-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
                          Paid
                        </span>
                        {access.isEditor && (
                          <form action={markInstallmentRefunded}>
                            <input type="hidden" name="installmentId" value={installment.id} />
                            <input type="hidden" name="eventId" value={event.id} />
                            <button type="submit" className="text-[10px] font-extrabold text-primary underline">
                              Mark Refunded
                            </button>
                          </form>
                        )}
                      </div>
                    ) : installment.status === "refunded" ? (
                      <span className="rounded-pill border-2 border-border bg-surface px-2 py-0.5 text-[10px] font-extrabold uppercase text-text-muted">
                        Refunded
                      </span>
                    ) : access.isEditor && plan.status !== "draft" ? (
                      <form action={markInstallmentPaid}>
                        <input type="hidden" name="installmentId" value={installment.id} />
                        <input type="hidden" name="eventId" value={event.id} />
                        <Button type="submit" variant="secondary">
                          Mark Paid
                        </Button>
                      </form>
                    ) : access.isEditor ? (
                      <span className="max-w-[110px] text-right text-[10px] font-semibold text-text-muted">
                        Activate the plan to mark paid
                      </span>
                    ) : (
                      <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
                        {installment.status}
                      </span>
                    )}
                  </div>
                  {(installment.proofUrl || access.isEditor) && (
                    <ProofOfPaymentForm
                      installmentId={installment.id}
                      eventId={event.id}
                      proofUrl={installment.proofUrl}
                      storagePath={installment.proof_of_payment_path}
                      isEditor={access.isEditor}
                    />
                  )}
                </Card>
              </StaggerItem>
            ))}
          </StaggerList>
        </>
      )}
    </main>
  );
}
