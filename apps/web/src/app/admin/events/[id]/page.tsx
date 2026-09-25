import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card, LinkCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEventDateTime } from "@gather/shared/utils";
import { cancelEventAsAdmin } from "./actions";

interface EventDetail {
  id: string;
  name: string;
  status: "draft" | "published" | "cancelled";
  visibility: string;
  start_at: string;
  location: string | null;
  owner: { id: string; display_name: string | null } | null;
}

interface AttendeeRow {
  id: string;
  name: string | null;
  rsvp_status: string;
}

interface TaskRow {
  id: string;
  title: string;
  completed: boolean;
}

interface VendorRow {
  id: string;
  status: string;
  vendors: { id: string; name: string } | null;
}

interface CollaboratorRow {
  id: string;
  permission_level: string;
  status: string;
  profiles: { id: string; display_name: string | null } | null;
}

interface CaseRow {
  id: string;
  subject: string;
  status: string;
}

export default async function AdminEventDetailPage({ params }: PageProps<"/admin/events/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const service = createServiceClient();

  const { data: event } = await service
    .from("events")
    .select("id, name, status, visibility, start_at, location, owner:profiles!events_owner_id_profiles_id_fk(id, display_name)")
    .eq("id", id)
    .maybeSingle<EventDetail>();

  if (!event) {
    notFound();
  }

  const [{ data: attendees }, { data: tasks }, { data: vendors }, { data: collaborators }, { data: cases }] = await Promise.all([
    service.from("event_attendees").select("id, name, rsvp_status").eq("event_id", id).returns<AttendeeRow[]>(),
    service.from("event_tasks").select("id, title, completed").eq("event_id", id).returns<TaskRow[]>(),
    service.from("event_vendors").select("id, status, vendors(id, name)").eq("event_id", id).returns<VendorRow[]>(),
    service
      .from("event_collaborators")
      .select("id, permission_level, status, profiles!event_collaborators_user_id_profiles_id_fk(id, display_name)")
      .eq("event_id", id)
      .returns<CollaboratorRow[]>(),
    service.from("support_cases").select("id, subject, status").eq("related_event_id", id).returns<CaseRow[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-ink">{event.name}</h1>
          <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
            {event.status}
          </span>
        </div>
        <p className="text-sm font-semibold text-text-muted">
          {formatEventDateTime(event.start_at)}
          {event.location ? ` · ${event.location}` : ""} · {event.visibility}
        </p>
        {event.owner && (
          <LinkCard href={`/admin/planners/${event.owner.id}`} className="w-fit">
            <p className="text-xs font-semibold text-text-muted">
              Owner: <span className="font-bold text-text">{event.owner.display_name ?? "Unknown"}</span>
            </p>
          </LinkCard>
        )}
      </div>

      {event.status !== "cancelled" && (
        <form action={cancelEventAsAdmin}>
          <input type="hidden" name="eventId" value={event.id} />
          <Button type="submit" variant="secondary">
            Cancel Event
          </Button>
        </form>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Attendees ({attendees?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {attendees && attendees.length > 0 ? (
            attendees.map((a) => (
              <Card key={a.id} className="flex items-center justify-between">
                <p className="text-sm font-bold text-text">{a.name ?? "Guest"}</p>
                <p className="text-xs font-semibold text-text-muted">{a.rsvp_status}</p>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No attendees.</p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Tasks ({tasks?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {tasks && tasks.length > 0 ? (
            tasks.map((t) => (
              <Card key={t.id} className="flex items-center justify-between">
                <p className="text-sm font-bold text-text">{t.title}</p>
                <p className="text-xs font-semibold text-text-muted">{t.completed ? "Done" : "Pending"}</p>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No tasks.</p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Vendors ({vendors?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {vendors && vendors.length > 0 ? (
            vendors.map((v) => (
              <LinkCard
                key={v.id}
                href={v.vendors ? `/admin/vendors/${v.vendors.id}` : "/admin/vendors"}
                className="flex items-center justify-between"
              >
                <p className="text-sm font-bold text-text">{v.vendors?.name ?? "Unknown vendor"}</p>
                <p className="text-xs font-semibold text-text-muted">{v.status}</p>
              </LinkCard>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No vendors associated.</p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Collaborators ({collaborators?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {collaborators && collaborators.length > 0 ? (
            collaborators.map((c) => (
              <LinkCard
                key={c.id}
                href={c.profiles ? `/admin/planners/${c.profiles.id}` : "/admin/planners"}
                className="flex items-center justify-between"
              >
                <p className="text-sm font-bold text-text">{c.profiles?.display_name ?? "Unknown"}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {c.permission_level} · {c.status}
                </p>
              </LinkCard>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No collaborators.</p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Case History ({cases?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {cases && cases.length > 0 ? (
            cases.map((c) => (
              <LinkCard key={c.id} href={`/admin/cases/${c.id}`} className="flex items-center justify-between">
                <p className="text-sm font-bold text-text">{c.subject}</p>
                <p className="text-xs font-semibold text-text-muted">{c.status}</p>
              </LinkCard>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No cases logged for this event.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
