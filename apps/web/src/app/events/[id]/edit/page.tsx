import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { isoToSastInput } from "@gather/shared/utils";
import { EventForm } from "../../event-form";
import { getEventAccess } from "../access";
import { updateEvent } from "./actions";

interface EditableEvent {
  id: string;
  owner_id: string;
  name: string;
  event_type: string | null;
  event_type_id: string | null;
  start_at: string;
  end_at: string | null;
  rsvp_date: string | null;
  location: string | null;
  description: string | null;
  visibility: "public" | "private" | "invite_only";
  capacity: number | null;
  budget_total: string | null;
  budget_warning_percent: number | null;
  status: "draft" | "published" | "cancelled";
}

// The event's own SELECT policy would let a Viewer-only collaborator load
// this page's data (same row an owner sees), even though RLS blocks their
// actual update — checked explicitly here so a Viewer gets a clean
// notFound() instead of a form that silently fails to save.
export default async function EditEventPage({ params }: PageProps<"/events/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, owner_id, name, event_type, event_type_id, start_at, end_at, rsvp_date, location, description, visibility, capacity, budget_total, budget_warning_percent, status",
    )
    .eq("id", id)
    .maybeSingle<EditableEvent>();

  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);

  if (!access.isEditor) {
    notFound();
  }

  const { data: eventTypes } = await supabase.from("event_types").select("id, name").eq("is_active", true).order("name");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Edit Event" />
      <EventForm
        action={updateEvent}
        eventId={event.id}
        eventTypes={eventTypes ?? []}
        submitLabel="Save Changes"
        defaultValues={{
          name: event.name,
          eventTypeId: event.event_type_id,
          eventTypeOther: event.event_type_id ? undefined : (event.event_type ?? undefined),
          startAt: isoToSastInput(event.start_at),
          endAt: isoToSastInput(event.end_at),
          rsvpDate: event.rsvp_date,
          location: event.location ?? "",
          description: event.description ?? "",
          visibility: event.visibility,
          capacity: event.capacity,
          budgetTotal: event.budget_total ? Number(event.budget_total) : null,
          budgetWarningPercent: event.budget_warning_percent,
          published: event.status === "published",
        }}
      />
    </main>
  );
}
