import { notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { Card, LinkCard } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatZAR } from "@/lib/utils";
import { getEventAccess } from "../access";
import { CreatePlanForm } from "./create-plan-form";
import { AddInstallmentForm } from "./add-installment-form";
import { activatePlan, markInstallmentPaid, setPlanBudgetItem } from "./actions";

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
  status: "pending" | "paid" | "late" | "cancelled";
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
    const { data: eventVendors } = await supabase
      .from("event_vendors")
      .select("id, vendors(name)")
      .eq("event_id", event.id)
      .returns<EventVendorOption[]>();

    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
        <div className="flex flex-col gap-2">
          <BackButton />
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">Payments</h1>
            <p className="mt-1 text-sm font-semibold text-text-muted">
              A plan you set up and maintain yourself, organized by vendor — pick one to create or manage it.
            </p>
          </div>
        </div>
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
        .select("id, installment_number, due_date, amount, status")
        .eq("payment_plan_id", plan.id)
        .order("installment_number", { ascending: true })
        .returns<InstallmentRow[]>()
    : { data: [] as InstallmentRow[] };

  const paid = (installments ?? [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const total = plan ? Number(plan.total_amount) : 0;
  const nextInstallmentNumber = (installments?.length ?? 0) + 1;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <BackButton />
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Payments</h1>
          <p className="mt-1 text-sm font-semibold text-text-muted">{eventVendor.vendors?.name ?? "Vendor"}</p>
        </div>
      </div>

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
            <form action={setPlanBudgetItem} className="flex items-center gap-2">
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="eventId" value={event.id} />
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
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>
          )}

          <StaggerList className="flex flex-col gap-2">
            {(installments ?? []).map((installment) => (
              <StaggerItem key={installment.id}>
                <Card className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-text">
                      #{installment.installment_number} · {formatZAR(installment.amount)}
                    </p>
                    <p className="text-xs font-semibold text-text-muted">Due {installment.due_date}</p>
                  </div>
                  {installment.status === "paid" ? (
                    <span className="rounded-pill bg-success-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
                      Paid
                    </span>
                  ) : access.isEditor ? (
                    <form action={markInstallmentPaid}>
                      <input type="hidden" name="installmentId" value={installment.id} />
                      <input type="hidden" name="eventId" value={event.id} />
                      <Button type="submit" variant="secondary">
                        Mark Paid
                      </Button>
                    </form>
                  ) : (
                    <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
                      {installment.status}
                    </span>
                  )}
                </Card>
              </StaggerItem>
            ))}
          </StaggerList>

          {access.isEditor && (
            <AddInstallmentForm paymentPlanId={plan.id} eventId={event.id} nextInstallmentNumber={nextInstallmentNumber} />
          )}
        </>
      )}
    </main>
  );
}
