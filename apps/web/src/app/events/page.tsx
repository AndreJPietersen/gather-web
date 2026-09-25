import Link from "next/link";
import { ListTodo, Wallet } from "lucide-react";
import { LinkCard } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateTime } from "@/lib/utils";
import { getUpcomingWindow, upcomingCutoffDate, isInstallmentOverdue } from "@/lib/upcoming";

interface MyEvent {
  id: string;
  name: string;
  status: "draft" | "published" | "cancelled";
  start_at: string;
  location: string | null;
  owner_id: string;
}

const statusLabelClasses: Record<MyEvent["status"], string> = {
  draft: "bg-secondary-soft text-ink",
  published: "bg-success-soft text-ink",
  cancelled: "bg-primary-soft text-primary",
};

function buildEventsHref(overrides: { sort?: "asc" | "desc"; includePublic?: boolean }, current: { sort: "asc" | "desc"; includePublic: boolean }) {
  const params = new URLSearchParams();
  const sort = overrides.sort ?? current.sort;
  const includePublic = overrides.includePublic ?? current.includePublic;
  if (sort === "desc") params.set("sort", "desc");
  if (includePublic) params.set("includePublic", "1");
  const qs = params.toString();
  return qs ? `/events?${qs}` : "/events";
}

// The real My Events list — replaces the Phase 2 placeholder.
//
// events_select_public is a separate, deliberately permissive RLS policy
// (any published+public event, visible to every authenticated user, not
// just guests) that exists so Home's public directory works without its
// own bespoke policy. Left unfiltered, that means a plain `select * from
// events` here — relying only on RLS to scope the results — returns every
// public event in the whole system, not just this user's own, each one
// silently mislabeled "Invited" by the Hosting/Invited badge below. Found
// live: a brand-new signup with zero real invites saw several unrelated
// published test events on this page. Fixed by querying this user's real
// ownership/collaboration explicitly (a second query for their
// event_collaborators rows, merged into an `.or()` filter) instead of
// trusting RLS's necessarily-broader OR to also mean "mine." The
// `includePublic` toggle below opts back into the wider directory
// on purpose, with its own "Public" badge so it's never confused with a
// real invite again.
export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const { sort, includePublic: includePublicParam } = await searchParams;
  // Date-ascending (soonest first) was already the fixed default — this
  // just makes the direction a real, toggleable choice instead of a silent
  // one. "asc" stays paramless so the plain /events URL keeps working.
  const sortDirection: "asc" | "desc" = sort === "desc" ? "desc" : "asc";
  const includePublic = includePublicParam === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const collaboratorEventIds = new Set<string>();
  let events: MyEvent[] | null = [];

  if (user) {
    const { data: collabRows } = await supabase
      .from("event_collaborators")
      .select("event_id")
      .eq("user_id", user.id)
      .returns<{ event_id: string }[]>();
    (collabRows ?? []).forEach((row) => collaboratorEventIds.add(row.event_id));

    const orClauses = [`owner_id.eq.${user.id}`];
    if (collaboratorEventIds.size > 0) {
      orClauses.push(`id.in.(${Array.from(collaboratorEventIds).join(",")})`);
    }
    if (includePublic) {
      orClauses.push("and(status.eq.published,visibility.eq.public)");
    }

    const { data } = await supabase
      .from("events")
      .select("id, name, status, start_at, location, owner_id")
      .or(orClauses.join(","))
      .order("start_at", { ascending: sortDirection === "asc" })
      .returns<MyEvent[]>();
    events = data;
  }

  // Per-event pending markers, same "upcoming window" preference Home's own
  // Upcoming Tasks/Payments sections use (Profile > Notifications &
  // Reminders) — computed as two Sets of event ids rather than N+1 queries
  // per event card.
  let eventIdsWithPendingTasks = new Set<string>();
  let eventIdsWithPendingPayments = new Set<string>();
  let eventIdsWithOverduePayments = new Set<string>();
  if (user && events && events.length > 0) {
    const upcomingWindow = await getUpcomingWindow(supabase, user.id);
    const cutoff = upcomingCutoffDate(upcomingWindow);
    const eventIds = events.map((e) => e.id);

    const [{ data: pendingTasks }, { data: pendingInstallments }] = await Promise.all([
      supabase
        .from("event_tasks")
        .select("event_id")
        .eq("completed", false)
        .not("due_date", "is", null)
        .lte("due_date", cutoff)
        .in("event_id", eventIds)
        .returns<{ event_id: string }[]>(),
      supabase
        .from("payment_installments")
        .select("status, due_date, payment_plans(event_vendors(event_id))")
        .in("status", ["pending", "late"])
        .lte("due_date", cutoff)
        .returns<{ status: string; due_date: string; payment_plans: { event_vendors: { event_id: string } | null } | null }[]>(),
    ]);

    eventIdsWithPendingTasks = new Set((pendingTasks ?? []).map((t) => t.event_id));
    eventIdsWithPendingPayments = new Set(
      (pendingInstallments ?? [])
        .map((i) => i.payment_plans?.event_vendors?.event_id)
        .filter((id): id is string => Boolean(id)),
    );
    eventIdsWithOverduePayments = new Set(
      (pendingInstallments ?? [])
        .filter((i) => isInstallmentOverdue(i.status, i.due_date))
        .map((i) => i.payment_plans?.event_vendors?.event_id)
        .filter((id): id is string => Boolean(id)),
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink">My Events</h1>
        <Link href="/events/new" className="rounded-pill bg-primary px-4 py-2 text-xs font-extrabold text-white">
          + New
        </Link>
      </div>

      <div className="flex gap-2">
        <Link
          href={buildEventsHref({ sort: sortDirection === "asc" ? "desc" : "asc" }, { sort: sortDirection, includePublic })}
          className="rounded-pill border-2 border-border bg-surface px-2.5 py-1 text-[11px] font-extrabold text-text-muted"
        >
          Date {sortDirection === "asc" ? "↑" : "↓"}
        </Link>
        <Link
          href={buildEventsHref({ includePublic: !includePublic }, { sort: sortDirection, includePublic })}
          className={`rounded-pill px-2.5 py-1 text-[11px] font-extrabold ${
            includePublic ? "bg-primary-soft text-primary" : "border-2 border-border bg-surface text-text-muted"
          }`}
        >
          Public events
        </Link>
      </div>

      <StaggerList className="flex flex-col gap-3">
        {events && events.length > 0 ? (
          events.map((event) => {
            const badge =
              event.owner_id === user?.id ? "Hosting" : collaboratorEventIds.has(event.id) ? "Invited" : "Public";
            return (
            <StaggerItem key={event.id}>
              <LinkCard href={`/events/${event.id}`} className="flex flex-col gap-1">
                <p className="text-sm font-extrabold text-text">{event.name}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      badge === "Hosting"
                        ? "bg-primary-soft text-primary"
                        : badge === "Invited"
                          ? "border-2 border-border bg-surface text-text-muted"
                          : "bg-secondary-soft text-ink"
                    }`}
                  >
                    {badge}
                  </span>
                  <span
                    className={`rounded-pill px-2 py-0.5 text-[10px] font-extrabold uppercase ${statusLabelClasses[event.status]}`}
                  >
                    {event.status}
                  </span>
                  {eventIdsWithPendingTasks.has(event.id) && (
                    <span
                      title="Has upcoming tasks"
                      aria-label="Has upcoming tasks"
                      className="flex items-center gap-1 rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold text-ink"
                    >
                      <ListTodo size={11} strokeWidth={2.5} />
                      Tasks
                    </span>
                  )}
                  {eventIdsWithPendingPayments.has(event.id) && (
                    <span
                      title={eventIdsWithOverduePayments.has(event.id) ? "Has an overdue payment" : "Has upcoming payments"}
                      aria-label={eventIdsWithOverduePayments.has(event.id) ? "Has an overdue payment" : "Has upcoming payments"}
                      className="flex items-center gap-1 rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold text-primary"
                    >
                      <Wallet size={11} strokeWidth={2.5} />
                      {eventIdsWithOverduePayments.has(event.id) ? "Overdue" : "Payment"}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-text-muted">
                  {formatEventDateTime(event.start_at)}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </LinkCard>
            </StaggerItem>
            );
          })
        ) : (
          // A LinkCard, not a plain Card — this message reads as tappable
          // (same rounded-card shape every real row on this page uses), and
          // a real planner tapped it expecting it to work. Points at the
          // same /events/new the header's own "+ New" button does.
          <LinkCard href="/events/new">
            <p className="text-sm font-semibold text-text-muted">No events yet — create your first one.</p>
          </LinkCard>
        )}
      </StaggerList>
    </main>
  );
}
