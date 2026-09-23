import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, ListTodo, Store, Wallet, PiggyBank, Image as ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateTime, getCountdownRemaining } from "@/lib/utils";
import { isInstallmentOverdue } from "@/lib/upcoming";
import { RsvpForm } from "./rsvp-form";
import { InviteCollaboratorForm } from "./invite-collaborator-form";
import { CountdownCard } from "./countdown-card";
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
  const countdown = getCountdownRemaining(event.start_at);

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

  // Feeds only the Payments tile's small overdue badge below — deliberately
  // not the "due soon but not yet overdue" case too, which is already well
  // covered by Home and My Events; a compact icon tile only needs to
  // interrupt for something actually urgent. A two-hop query (event_vendors
  // -> payment_plans -> installments), the same "flat query, no RPC" shape
  // this app's other cross-table checks already use, rather than filtering
  // every pending installment in the system down to this one event's.
  let hasOverduePayment = false;
  if (isManagementView) {
    const { data: eventVendorIds } = await supabase.from("event_vendors").select("id").eq("event_id", event.id);
    const evIds = (eventVendorIds ?? []).map((ev) => ev.id);
    if (evIds.length > 0) {
      const { data: planIds } = await supabase.from("payment_plans").select("id").in("event_vendor_id", evIds);
      const pIds = (planIds ?? []).map((p) => p.id);
      if (pIds.length > 0) {
        const { data: pendingInstallments } = await supabase
          .from("payment_installments")
          .select("status, due_date")
          .eq("status", "pending")
          .in("payment_plan_id", pIds)
          .returns<{ status: string; due_date: string }[]>();
        hasOverduePayment = (pendingInstallments ?? []).some((i) => isInstallmentOverdue(i.status, i.due_date));
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title={event.name}>
        {isManagementView && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary">
              {access.isOwner ? "Hosting" : access.isEditor ? "Editor" : "Viewer"}
            </span>
            <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
              {event.status}
            </span>
          </div>
        )}
        <p className="text-sm font-semibold text-text-muted">
          {formatEventDateTime(event.start_at)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </PageHeader>

      {/* Shown to guests too, not just the management view — deliberately
          outside the isManagementView branch below, same as the date/
          location line above it. Only rendered at all when start_at is
          still in the future; a countdown to a past event isn't useful,
          and CountdownCard itself makes the same call client-side if the
          event arrives while the tab is left open. */}
      {!countdown.done && <CountdownCard targetIso={event.start_at} initial={countdown} />}

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

          {/* "Colorful tint grid" — one of 4 directions sketched on the Event
              Nav Options design canvas, picked by Andre over a neutral
              icon-tile grid, list rows, and a lightly-updated version of the
              plain pill grid this replaces. Each tile's background is a full
              soft-accent tint (not just a small icon badge), rotating
              through the 3 theme tokens every page already has
              (primary-soft/secondary-soft/success-soft) so the grid reads
              correctly in all 3 color themes with zero per-tile overrides.
              text-ink (not text-secondary) on the two secondary-soft tiles
              is deliberate, not an inconsistency with the primary/success
              tiles: --color-secondary is a light, low-contrast yellow in
              every theme, so an icon drawn in it directly would be barely
              visible against its own equally-light soft background. */}
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              href={`/events/${event.id}/budget`}
              className="flex flex-col gap-3 rounded-[20px] bg-primary-soft p-4"
            >
              <PiggyBank size={24} strokeWidth={2} className="text-primary" />
              <span className="text-[13px] font-extrabold text-ink">Budget</span>
            </Link>
            <Link
              href={`/events/${event.id}/attendees`}
              className="flex flex-col gap-3 rounded-[20px] bg-secondary-soft p-4"
            >
              <Users size={24} strokeWidth={2} className="text-ink" />
              <span className="text-[13px] font-extrabold text-ink">Attendees</span>
            </Link>
            <Link
              href={`/events/${event.id}/vendors`}
              className="flex flex-col gap-3 rounded-[20px] bg-success-soft p-4"
            >
              <Store size={24} strokeWidth={2} className="text-success" />
              <span className="text-[13px] font-extrabold text-ink">Vendors</span>
            </Link>
            <Link
              href={`/events/${event.id}/payments`}
              className="relative flex flex-col gap-3 rounded-[20px] bg-primary-soft p-4"
            >
              {hasOverduePayment && (
                <span
                  title="Has an overdue payment"
                  aria-label="Has an overdue payment"
                  className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-primary"
                />
              )}
              <Wallet size={24} strokeWidth={2} className="text-primary" />
              <span className="text-[13px] font-extrabold text-ink">Payments</span>
            </Link>
            <Link
              href={`/events/${event.id}/tasks`}
              className="flex flex-col gap-3 rounded-[20px] bg-secondary-soft p-4"
            >
              <ListTodo size={24} strokeWidth={2} className="text-ink" />
              <span className="text-[13px] font-extrabold text-ink">Tasks</span>
            </Link>
            <Link
              href={`/events/${event.id}/gallery`}
              className="flex flex-col gap-3 rounded-[20px] bg-success-soft p-4"
            >
              <ImageIcon size={24} strokeWidth={2} className="text-success" />
              <span className="text-[13px] font-extrabold text-ink">Gallery</span>
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
              <StaggerList className="mt-3 flex flex-col gap-2">
                {collaborators.map((c) => (
                  <StaggerItem key={c.user_id}>
                    <Card className="flex items-center justify-between">
                      <p className="text-sm font-bold text-text">{c.invitee?.display_name ?? "Pending user"}</p>
                      <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary">
                        {c.permission_level} · {c.status}
                      </span>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerList>
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
