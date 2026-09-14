import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isoToSastInput } from "@/lib/utils";
import { EventForm } from "../../event-form";
import { getEventAccess } from "../access";
import { updateEvent } from "./actions";

interface EditableEvent {
  id: string;
  owner_id: string;
  name: string;
  event_type: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  description: string | null;
  visibility: "public" | "private" | "invite_only";
  capacity: number | null;
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
    .select("id, owner_id, name, event_type, start_at, end_at, location, description, visibility, capacity, status")
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

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-ink">Edit Event</h1>
      <EventForm
        action={updateEvent}
        eventId={event.id}
        submitLabel="Save Changes"
        defaultValues={{
          name: event.name,
          eventType: event.event_type ?? "",
          startAt: isoToSastInput(event.start_at),
          endAt: isoToSastInput(event.end_at),
          location: event.location ?? "",
          description: event.description ?? "",
          visibility: event.visibility,
          capacity: event.capacity,
          published: event.status === "published",
        }}
      />
    </main>
  );
}
