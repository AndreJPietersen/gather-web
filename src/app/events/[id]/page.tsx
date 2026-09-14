import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils";
import { RsvpForm } from "./rsvp-form";
import { InviteCollaboratorForm } from "./invite-collaborator-form";
import { getEventAccess } from "./access";

interface EventDetail {
  id: string;
  owner_id: string;
  name: string;
  event_type: string | null;
  start_at: string;
  location: string | null;
  description: string | null;
  capacity: number | null;
  status: "draft" | "published" | "cancelled";
}

interface CollaboratorRow {
  user_id: string;
  permission_level: "editor" | "viewer";
  status: "invited" | "accepted" | "declined";
  invitee: { display_name: string | null } | null;
}

// Guest branch (Phase 3) plus the owner/collaborator management branch
// (Phase 5) on the same route — not two separate pages, matching the
// Salesforce build's own gatherEventDetail shape (one component, branching
// on who's looking). No status/visibility filter on the query: the RLS
// union of events_select_public (guests, published+public only) and
// events_select_owner_or_collaborator (owner/any accepted collaborator,
// any status/visibility) already decides what a given request can see.
export default async function EventDetailPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, owner_id, name, event_type, start_at, location, description, capacity, status")
    .eq("id", id)
    .maybeSingle<EventDetail>();

  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);
  const isManagementView = access.isOwner || access.isCollaborator;

  let collaborators: CollaboratorRow[] = [];
  if (access.isOwner) {
    // event_collaborators has two FKs into profiles (user_id, invited_by),
    // which makes a plain `profiles(...)` embed ambiguous to PostgREST — it
    // errors (PGRST201), and since the query result wasn't destructuring
    // `error`, that failure was silently swallowed as "no collaborators".
    // The `!<constraint>` hint picks the user_id relationship specifically.
    const { data, error } = await supabase
      .from("event_collaborators")
      .select("user_id, permission_level, status, invitee:profiles!event_collaborators_user_id_profiles_id_fk(display_name)")
      .eq("event_id", event.id)
      .returns<CollaboratorRow[]>();
    if (error) {
      console.error("Failed to load collaborators", error);
    }
    collaborators = data ?? [];
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl font-semibold text-ink">{event.name}</h1>
          {isManagementView && (
            <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
              {event.status}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-semibold text-text-muted">
          {formatEventDateTime(event.start_at)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>

      {event.description && (
        <Card>
          <p className="text-sm font-semibold text-text">{event.description}</p>
        </Card>
      )}

      {isManagementView ? (
        <>
          {access.isEditor && (
            <Link href={`/events/${event.id}/edit`} className="text-sm font-extrabold text-primary">
              Edit event
            </Link>
          )}

          <div className="flex gap-2">
            <Link
              href={`/events/${event.id}/attendees`}
              className="flex-1 rounded-pill border-2 border-border bg-surface px-4 py-2.5 text-center text-xs font-extrabold text-text"
            >
              Attendees
            </Link>
            <Link
              href={`/events/${event.id}/tasks`}
              className="flex-1 rounded-pill border-2 border-border bg-surface px-4 py-2.5 text-center text-xs font-extrabold text-text"
            >
              Tasks
            </Link>
            <Link
              href={`/events/${event.id}/vendors`}
              className="flex-1 rounded-pill border-2 border-border bg-surface px-4 py-2.5 text-center text-xs font-extrabold text-text"
            >
              Vendors
            </Link>
          </div>

          {access.isEditor && (
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Invite a collaborator</h2>
              <div className="mt-3">
                <InviteCollaboratorForm eventId={event.id} />
              </div>
            </div>
          )}

          {access.isOwner && collaborators.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Collaborators</h2>
              <div className="mt-3 flex flex-col gap-2">
                {collaborators.map((c) => (
                  <Card key={c.user_id} className="flex items-center justify-between">
                    <p className="text-sm font-bold text-text">{c.invitee?.display_name ?? "Pending user"}</p>
                    <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                      {c.permission_level} · {c.status}
                    </span>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">RSVP</h2>
          <div className="mt-3">
            <RsvpForm eventId={event.id} />
          </div>
        </div>
      )}
    </main>
  );
}
