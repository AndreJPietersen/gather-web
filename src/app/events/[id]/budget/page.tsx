import Link from "next/link";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatZAR } from "@/lib/utils";
import { getEventAccess } from "../access";
import { DEFAULT_BUDGET_WARNING_PERCENT } from "../../budget-constants";
import { AddBudgetItemForm } from "./add-budget-item-form";
import { BudgetItemRow, type BudgetItem } from "./budget-item-row";

interface BudgetItemRowData {
  id: string;
  label: string;
  budgeted_amount: string;
  category_id: string | null;
  service_categories: { name: string } | null;
  event_vendor_id: string | null;
  event_vendors: { confirmed: boolean; vendors: { name: string } | null } | null;
  payment_plans: { total_amount: string }[];
}

// Committed spend (the header/warning number) is computed from every
// payment plan belonging to this event's vendors, not just ones tagged to
// a budget item — a plan created straight from a vendor's own Payments
// page (unchanged, still the only way to actually create one) must still
// count, or the warning would understate real spend for anyone who
// doesn't visit this page for every plan. Per-line "committed" display
// below, by contrast, only shows a plan if it's actually tagged to that
// specific line.
export default async function EventBudgetPage({ params }: PageProps<"/events/[id]/budget">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, owner_id, name, budget_total, budget_warning_percent")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      owner_id: string;
      name: string;
      budget_total: string | null;
      budget_warning_percent: number | null;
    }>();
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

  const [{ data: items }, { data: eventVendors }, { data: categories }] = await Promise.all([
    supabase
      .from("budget_items")
      .select(
        "id, label, budgeted_amount, category_id, service_categories(name), event_vendor_id, event_vendors(confirmed, vendors(name)), payment_plans(total_amount)",
      )
      .eq("event_id", event.id)
      .order("created_at", { ascending: true })
      .returns<BudgetItemRowData[]>(),
    supabase
      .from("event_vendors")
      .select("id, confirmed, vendors(name)")
      .eq("event_id", event.id)
      .returns<{ id: string; confirmed: boolean; vendors: { name: string } | null }[]>(),
    supabase.from("service_categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  const budgetItems: BudgetItem[] = (items ?? []).map((it) => ({
    id: it.id,
    label: it.label,
    budgeted_amount: it.budgeted_amount,
    category_id: it.category_id,
    category_name: it.service_categories?.name ?? null,
    event_vendor_id: it.event_vendor_id,
    vendor_name: it.event_vendors?.vendors?.name ?? null,
    vendor_confirmed: it.event_vendors?.confirmed ?? null,
    committed_amount: (it.payment_plans ?? []).reduce((sum, p) => sum + Number(p.total_amount), 0),
  }));

  const availableVendors = (eventVendors ?? []).map((v) => ({ id: v.id, name: v.vendors?.name ?? "Vendor" }));

  // Every payment plan for this event's vendors, regardless of budget-item
  // tagging — see the file-level comment above for why.
  const eventVendorIds = (eventVendors ?? []).map((v) => v.id);
  let totalCommitted = 0;
  if (eventVendorIds.length > 0) {
    const { data: allPlans } = await supabase
      .from("payment_plans")
      .select("total_amount")
      .in("event_vendor_id", eventVendorIds)
      .returns<{ total_amount: string }[]>();
    totalCommitted = (allPlans ?? []).reduce((sum, p) => sum + Number(p.total_amount), 0);
  }

  const budgetTotal = event.budget_total ? Number(event.budget_total) : null;
  const warningPercent = event.budget_warning_percent ?? DEFAULT_BUDGET_WARNING_PERCENT;
  const pctUsed = budgetTotal ? Math.round((totalCommitted / budgetTotal) * 100) : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-3xl font-semibold text-ink">Budget</h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">{event.name}</p>
        <p className="text-2xl font-extrabold text-ink">
          {formatZAR(totalCommitted)} <span className="text-base font-semibold text-text-muted">committed</span>
        </p>
        {budgetTotal !== null ? (
          <p className="text-sm font-semibold text-text-muted">
            of {formatZAR(budgetTotal)} budget ({pctUsed}%)
          </p>
        ) : (
          access.isEditor && (
            <Link href={`/events/${event.id}/edit`} className="text-xs font-extrabold text-primary">
              Set a total budget
            </Link>
          )
        )}
      </div>

      {budgetTotal !== null && pctUsed !== null && pctUsed >= 100 && (
        <Card className="bg-primary-soft">
          <p className="text-sm font-extrabold text-primary">
            Over budget — {formatZAR(totalCommitted)} committed against a {formatZAR(budgetTotal)} budget.
          </p>
        </Card>
      )}
      {budgetTotal !== null && pctUsed !== null && pctUsed >= warningPercent && pctUsed < 100 && (
        <Card className="bg-secondary-soft">
          <p className="text-sm font-extrabold text-ink">
            Approaching budget — {pctUsed}% committed ({formatZAR(totalCommitted)} of {formatZAR(budgetTotal)}).
          </p>
        </Card>
      )}

      {access.isEditor && <AddBudgetItemForm eventId={event.id} categories={categories ?? []} />}

      <StaggerList className="flex flex-col gap-2">
        {budgetItems.length > 0 ? (
          budgetItems.map((item) => (
            <StaggerItem key={item.id}>
              <BudgetItemRow
                item={item}
                eventId={event.id}
                canEdit={access.isEditor}
                categories={categories ?? []}
                availableVendors={availableVendors}
              />
            </StaggerItem>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No budget items yet.</p>
          </Card>
        )}
      </StaggerList>
    </main>
  );
}
