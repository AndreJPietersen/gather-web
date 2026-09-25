import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewEventTypeForm } from "./new-event-type-form";
import { setEventTypeActive, promoteOtherType } from "./actions";

interface EventTypeRow {
  id: string;
  name: string;
  is_active: boolean;
}

interface OtherTypeGroup {
  name: string;
  count: number;
}

// The dropdown planners see on /events/new and /events/[id]/edit is driven
// entirely by this list (is_active = true, per that page's own query) —
// deactivating a type here stops it being offered as a new choice without
// touching any event that already used it (events.event_type_id is
// nullable and set null on delete; deactivating doesn't even delete the
// row). Each type links through to its own page to manage which service
// categories are relevant to it (the "Suggested Vendors" mapping).
export default async function AdminEventTypesPage() {
  await requireAdmin();
  const service = createServiceClient();

  const { data: eventTypes } = await service
    .from("event_types")
    .select("id, name, is_active")
    .order("name")
    .returns<EventTypeRow[]>();

  // "Other" events (event_type_id null, free text present) grouped by exact
  // text match — Supabase-js has no GROUP BY, and the expected row count
  // here is small, so aggregating in JS is simpler than a raw-SQL view or
  // RPC for what's fundamentally a small admin-facing report. Sorted by
  // count so the entries most worth promoting into a real type surface
  // first.
  const { data: otherEvents } = await service
    .from("events")
    .select("event_type")
    .is("event_type_id", null)
    .not("event_type", "is", null)
    .returns<{ event_type: string }[]>();

  const otherCounts = new Map<string, number>();
  for (const row of otherEvents ?? []) {
    otherCounts.set(row.event_type, (otherCounts.get(row.event_type) ?? 0) + 1);
  }
  const otherGroups: OtherTypeGroup[] = Array.from(otherCounts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-ink">Event Types</h1>
        <p className="text-sm font-semibold text-text-muted">
          Shown as a dropdown when a planner creates or edits an event. Open a type to manage which service
          categories are relevant to it — that&apos;s what powers Suggested Vendors.
        </p>
      </div>

      <NewEventTypeForm />

      <div className="flex flex-col gap-2">
        {eventTypes && eventTypes.length > 0 ? (
          eventTypes.map((type) => (
            <Card key={type.id} className="flex items-center justify-between gap-2">
              <Link href={`/admin/event-types/${type.id}`} className="min-w-0 flex-1">
                <p className="text-sm font-bold text-text">{type.name}</p>
                {!type.is_active && <p className="text-xs font-semibold text-text-muted">Inactive</p>}
              </Link>
              <form action={setEventTypeActive}>
                <input type="hidden" name="id" value={type.id} />
                <input type="hidden" name="nextActive" value={(!type.is_active).toString()} />
                <Button type="submit" variant="secondary">
                  {type.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </form>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No event types yet.</p>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">&quot;Other&quot; Free Text</h2>
          <p className="text-sm font-semibold text-text-muted">
            What planners typed when nothing in the list fit, grouped by exact match. Promoting one creates it as a
            real type above and re-points every matching event at it.
          </p>
        </div>
        {otherGroups.length > 0 ? (
          otherGroups.map((group) => (
            <Card key={group.name} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text">{group.name}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {group.count} event{group.count === 1 ? "" : "s"}
                </p>
              </div>
              <form action={promoteOtherType}>
                <input type="hidden" name="name" value={group.name} />
                <Button type="submit" variant="primary">
                  Add as type
                </Button>
              </form>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No &quot;Other&quot; entries yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
