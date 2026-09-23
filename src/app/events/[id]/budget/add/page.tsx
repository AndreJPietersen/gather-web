import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../../access";
import { getSuggestedBudgetCategories } from "../suggested-categories";
import { BudgetItemsPanel } from "../budget-items-panel";

// A dedicated screen rather than the inline panel the Budget list page used
// to open onto directly — same "+ New" pattern as /events/new: the list
// page's header gets a top-right add action, and this is what it opens onto.
// createBudgetItem redirects straight back to the list on success (Andre's
// own ask), so adding several suggested categories in one sitting costs one
// extra "+ Add" tap per line now instead of nothing — a deliberate tradeoff
// for landing back on the updated list immediately.
export default async function AddBudgetItemPage({ params }: PageProps<"/events/[id]/budget/add">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, owner_id, name, event_type_id")
    .eq("id", id)
    .maybeSingle<{ id: string; owner_id: string; name: string; event_type_id: string | null }>();
  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);
  // Matches budget_items_insert_owner_or_editor — a Viewer-permission
  // collaborator can load the event (events' own SELECT policy is broader
  // than this), but has no business landing on an add screen they can't
  // actually submit against.
  if (!access.isEditor) {
    notFound();
  }

  const [{ data: categories }, suggestedCategories] = await Promise.all([
    supabase.from("service_categories").select("id, name").eq("is_active", true).order("name"),
    getSuggestedBudgetCategories(event.id, event.event_type_id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Add Budget Item">
        <p className="text-sm font-semibold text-text-muted">{event.name}</p>
      </PageHeader>

      <BudgetItemsPanel eventId={event.id} categories={categories ?? []} suggestedCategories={suggestedCategories} />
    </main>
  );
}
