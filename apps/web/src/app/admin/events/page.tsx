import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { Card, LinkCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatEventDateTime } from "@gather/shared/utils";

interface EventRow {
  id: string;
  name: string;
  status: "draft" | "published" | "cancelled";
  visibility: "public" | "private" | "invite_only";
  start_at: string;
  owner: { display_name: string | null } | null;
}

const statusClasses: Record<EventRow["status"], string> = {
  draft: "bg-secondary-soft text-ink",
  published: "bg-success-soft text-ink",
  cancelled: "bg-primary-soft text-primary",
};

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/events">) {
  await requireAdmin();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";

  const service = createServiceClient();
  let eventsQuery = service
    .from("events")
    .select("id, name, status, visibility, start_at, owner:profiles!events_owner_id_profiles_id_fk(display_name)");
  if (query) {
    eventsQuery = eventsQuery.ilike("name", `%${query}%`);
  }
  const { data: events } = await eventsQuery
    .order("start_at", { ascending: false })
    .limit(100)
    .returns<EventRow[]>();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Events</h1>

      <form method="get" className="flex gap-2">
        <Input name="q" defaultValue={query} placeholder="Search by name" className="max-w-xs" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        {events && events.length > 0 ? (
          events.map((event) => (
            <LinkCard key={event.id} href={`/admin/events/${event.id}`} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-text">{event.name}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {event.owner?.display_name ?? "Unknown owner"} · {formatEventDateTime(event.start_at)} ·{" "}
                  {event.visibility}
                </p>
              </div>
              <span className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusClasses[event.status]}`}>
                {event.status}
              </span>
            </LinkCard>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No events match.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
