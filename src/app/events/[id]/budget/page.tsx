import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, LinkCard } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatZAR } from "@/lib/utils";
import { getEventAccess } from "../access";
import { DEFAULT_BUDGET_WARNING_PERCENT } from "../../budget-constants";
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
    .select("id, owner_id, name, event_type_id, budget_total, budget_warning_percent")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      owner_id: string;
      name: string;
      event_type_id: string | null;
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
    // Excludes 'rejected' — same filter the Vendors list page applies, so a
    // removed vendor (soft-removed, never actually deleted — see
    // removeVendorFromEvent) can't be picked again from "Link a vendor" on
    // a budget line.
    supabase
      .from("event_vendors")
      .select("id, confirmed, vendors(name)")
      .eq("event_id", event.id)
      .neq("status", "rejected")
      .returns<{ id: string; confirmed: boolean; vendors: { name: string } | null }[]>(),
    supabase.from("service_categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  // Answers "why is this over/under budget" from the budget item's own
  // point of view, not just the payment plan's: an accepted quote and
  // payment_plans.total_amount (what committed_amount below is actually
  // summed from) are two independently hand-typed numbers with nothing
  // keeping them in sync — see the matching comment + warning on the
  // vendor detail page (events/[id]/vendors/[eventVendorId]/page.tsx),
  // which surfaces the exact same mismatch from the other side.
  const linkedEventVendorIds = (items ?? []).map((it) => it.event_vendor_id).filter((v): v is string => v !== null);
  let acceptedQuoteByEventVendor = new Map<string, number>();
  if (linkedEventVendorIds.length > 0) {
    const { data: acceptedQuotes } = await supabase
      .from("vendor_quotes")
      .select("event_vendor_id, amount")
      .eq("status", "accepted")
      .in("event_vendor_id", linkedEventVendorIds)
      .returns<{ event_vendor_id: string; amount: string }[]>();
    acceptedQuoteByEventVendor = new Map((acceptedQuotes ?? []).map((q) => [q.event_vendor_id, Number(q.amount)]));
  }

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
    accepted_quote_amount: it.event_vendor_id ? (acceptedQuoteByEventVendor.get(it.event_vendor_id) ?? null) : null,
  }));

  const availableVendors = (eventVendors ?? []).map((v) => ({ id: v.id, name: v.vendors?.name ?? "Vendor" }));

  // Every payment plan for this event's vendors, regardless of budget-item
  // tagging — see the file-level comment above for why. Grouped by vendor
  // (not just summed) so the header's total can be broken down into "where
  // did this number come from" — the same total shown two ways, since
  // there's no requirement a vendor have only one plan.
  const eventVendorIds = (eventVendors ?? []).map((v) => v.id);
  let totalCommitted = 0;
  const committedByEventVendor = new Map<string, number>();
  if (eventVendorIds.length > 0) {
    const { data: allPlans } = await supabase
      .from("payment_plans")
      .select("event_vendor_id, total_amount")
      .in("event_vendor_id", eventVendorIds)
      .returns<{ event_vendor_id: string; total_amount: string }[]>();
    for (const p of allPlans ?? []) {
      const amount = Number(p.total_amount);
      totalCommitted += amount;
      committedByEventVendor.set(p.event_vendor_id, (committedByEventVendor.get(p.event_vendor_id) ?? 0) + amount);
    }
  }

  const committedBreakdown = (eventVendors ?? [])
    .map((v) => ({ id: v.id, name: v.vendors?.name ?? "Vendor", amount: committedByEventVendor.get(v.id) ?? 0 }))
    .filter((v) => v.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const budgetTotal = event.budget_total ? Number(event.budget_total) : null;
  const warningPercent = event.budget_warning_percent ?? DEFAULT_BUDGET_WARNING_PERCENT;
  const pctUsed = budgetTotal ? Math.round((totalCommitted / budgetTotal) * 100) : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader
        title="Budget"
        action={
          access.isEditor && (
            <Link href={`/events/${event.id}/budget/add`} className="rounded-pill bg-primary px-4 py-2 text-xs font-extrabold text-white">
              + Add
            </Link>
          )
        }
      >
        <p className="text-sm font-semibold text-text-muted">{event.name}</p>
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
      </PageHeader>

      {committedBreakdown.length > 0 && (
        <details className="group rounded-[22px] bg-surface p-4 shadow-[0_6px_16px_-8px_var(--color-ink)]">
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-extrabold text-text marker:content-none">
            Where the committed amount comes from
            <span className="shrink-0 text-text-muted transition-transform group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {committedBreakdown.map((v) => (
              <Link
                key={v.id}
                href={`/events/${event.id}/payments?vendor=${v.id}`}
                className="flex items-center justify-between gap-2 rounded-field bg-bg px-3 py-2"
              >
                <span className="truncate text-xs font-bold text-text">{v.name}</span>
                <span className="shrink-0 text-xs font-extrabold text-primary">{formatZAR(v.amount)}</span>
              </Link>
            ))}
          </div>
        </details>
      )}

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
        ) : access.isEditor ? (
          <LinkCard href={`/events/${event.id}/budget/add`}>
            <p className="text-sm font-semibold text-text-muted">No budget items yet — tap to add one.</p>
          </LinkCard>
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No budget items yet.</p>
          </Card>
        )}
      </StaggerList>
    </main>
  );
}
