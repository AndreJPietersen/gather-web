import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../../access";
import { AddAttendeeForm } from "../add-attendee-form";

// Same "+ Add" pattern as /events/[id]/budget/add and /events/[id]/payments/
// add: the Attendees list page's header gets a top-right add action, and
// this is what it opens onto — addAttendee redirects straight back to the
// list on success (Andre's own ask across all three).
export default async function AddAttendeePage({ params }: PageProps<"/events/[id]/attendees/add">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, owner_id, name")
    .eq("id", id)
    .maybeSingle<{ id: string; owner_id: string; name: string }>();
  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);
  // Matches event_attendees_insert_owner_or_editor — a Viewer-permission
  // collaborator can load the event (events' own SELECT policy is broader
  // than this), but has no business landing on an add screen they can't
  // actually submit against.
  if (!access.isEditor) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Add Attendee">
        <p className="text-sm font-semibold text-text-muted">{event.name}</p>
      </PageHeader>

      <AddAttendeeForm eventId={event.id} />
    </main>
  );
}
