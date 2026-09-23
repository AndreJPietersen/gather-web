import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "../event-form";
import { createEvent } from "./actions";

export default async function NewEventPage() {
  const supabase = await createClient();
  const { data: eventTypes } = await supabase.from("event_types").select("id, name").eq("is_active", true).order("name");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="New Event" />
      <EventForm action={createEvent} eventTypes={eventTypes ?? []} submitLabel="Create Event" />
    </main>
  );
}
