import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils";

interface MyEvent {
  id: string;
  name: string;
  status: "draft" | "published" | "cancelled";
  start_at: string;
  location: string | null;
}

const statusLabelClasses: Record<MyEvent["status"], string> = {
  draft: "bg-secondary-soft text-ink",
  published: "bg-success-soft text-ink",
  cancelled: "bg-primary-soft text-primary",
};

// The real My Events list — replaces the Phase 2 placeholder. No explicit
// owner_id filter needed: events_select_owner_or_collaborator RLS already
// scopes this to events I own or am an accepted collaborator on.
export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, status, start_at, location")
    .order("start_at", { ascending: true })
    .returns<MyEvent[]>();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink">My Events</h1>
        <Link href="/events/new" className="rounded-pill bg-primary px-4 py-2 text-xs font-extrabold text-white">
          + New
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {events && events.length > 0 ? (
          events.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-text">{event.name}</p>
                  <span
                    className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusLabelClasses[event.status]}`}
                  >
                    {event.status}
                  </span>
                </div>
                <p className="text-xs font-semibold text-text-muted">
                  {formatEventDateTime(event.start_at)}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </Card>
            </Link>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No events yet — create your first one.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
