import { EventForm } from "../event-form";
import { createEvent } from "./actions";

export default function NewEventPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-ink">New Event</h1>
      <EventForm action={createEvent} submitLabel="Create Event" />
    </main>
  );
}
