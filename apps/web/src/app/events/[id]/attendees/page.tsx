import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, LinkCard } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { cn, formatEventDate, getCountdownRemaining } from "@gather/shared/utils";
import { isDateOverdue } from "@/lib/upcoming";
import { getEventAccess } from "../access";
import { AttendeeRow } from "./attendee-row";

interface AttendeeRowData {
  id: string;
  name: string | null;
  email: string | null;
  rsvp_status: "attending" | "declined" | "maybe" | "no_response";
  guest_count: number;
}

const RSVP_FILTERS = [
  { value: "attending", label: "Attending" },
  { value: "maybe", label: "Maybe" },
  { value: "declined", label: "Declined" },
  { value: "no_response", label: "No response" },
] as const;

const RSVP_STATUSES = RSVP_FILTERS.map((f) => f.value);

export default async function EventAttendeesPage({ params, searchParams }: PageProps<"/events/[id]/attendees">) {
  const { id } = await params;
  const { status } = await searchParams;
  const activeStatus = RSVP_STATUSES.includes(status as (typeof RSVP_STATUSES)[number])
    ? (status as (typeof RSVP_STATUSES)[number])
    : null;

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, owner_id, name, capacity, rsvp_date")
    .eq("id", id)
    .maybeSingle<{ id: string; owner_id: string; name: string; capacity: number | null; rsvp_date: string | null }>();
  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);
  if (!access.isOwner && !access.isCollaborator) {
    notFound();
  }

  // Always fetched unfiltered — the capacity total and the breakdown below
  // need the true event-wide counts regardless of which status the pills
  // are currently narrowed to, so filtering by status happens in JS against
  // this one query rather than as a second, narrower DB round-trip.
  const { data: allAttendees } = await supabase
    .from("event_attendees")
    .select("id, name, email, rsvp_status, guest_count")
    .eq("event_id", event.id)
    .order("name", { ascending: true })
    .returns<AttendeeRowData[]>();

  const attendees = allAttendees ?? [];
  const visibleAttendees = activeStatus ? attendees.filter((a) => a.rsvp_status === activeStatus) : attendees;

  // The headline number against capacity is real headcount, not row count —
  // an attendee bringing 2 extra guests takes up 3 spots, not 1. Bug fix:
  // this used to be plain attendees.length, undercounting anyone with
  // guest_count > 0.
  const totalHeadcount = attendees.reduce((sum, a) => sum + 1 + a.guest_count, 0);

  // Same headcount rule as totalHeadcount above (1 + guest_count per
  // attendee) so the per-status lines actually sum to "Total invited" —
  // they used to be plain record counts, which made the breakdown look
  // inconsistent with the header the moment any attendee had a guest.
  const statusCounts = RSVP_STATUSES.reduce(
    (acc, s) => {
      acc[s] = attendees.filter((a) => a.rsvp_status === s).reduce((sum, a) => sum + 1 + a.guest_count, 0);
      return acc;
    },
    {} as Record<(typeof RSVP_STATUSES)[number], number>,
  );

  // Once RSVP by has passed, "how many did I invite" stops being the
  // useful headline number — "how many are actually coming" (the same
  // headcount rule as statusCounts.attending above) is what a planner
  // finalizing catering/seating actually needs at a glance.
  const rsvpClosed = event.rsvp_date ? isDateOverdue(event.rsvp_date) : false;
  const daysUntilRsvp = event.rsvp_date && !rsvpClosed ? getCountdownRemaining(`${event.rsvp_date}T00:00:00Z`).days : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader
        title="Attendees"
        action={
          access.isEditor && (
            <Link
              href={`/events/${event.id}/attendees/add`}
              className="rounded-pill bg-primary px-4 py-2 text-xs font-extrabold text-white"
            >
              + Add
            </Link>
          )
        }
      >
        <p className="text-sm font-semibold text-text-muted">{event.name}</p>
        <p className="text-2xl font-extrabold text-ink">
          {rsvpClosed ? (
            <>
              {statusCounts.attending} <span className="text-base font-semibold text-text-muted">attending</span>
            </>
          ) : event.capacity ? (
            <>
              {totalHeadcount}{" "}
              <span className="text-base font-semibold text-text-muted">of {event.capacity} invited</span>
            </>
          ) : (
            <>
              {totalHeadcount} <span className="text-base font-semibold text-text-muted">invited</span>
            </>
          )}
        </p>
        {event.rsvp_date &&
          (rsvpClosed ? (
            <p className="text-xs font-semibold text-text-muted">RSVP closed {formatEventDate(event.rsvp_date)}</p>
          ) : (
            <div className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-secondary-soft px-3.5 py-1.5 text-ink">
              <Clock size={13} strokeWidth={2.5} />
              <span className="text-[11px] font-extrabold">
                RSVP by {formatEventDate(event.rsvp_date)} · {daysUntilRsvp === 0 ? "today" : `${daysUntilRsvp} day${daysUntilRsvp === 1 ? "" : "s"} left`}
              </span>
            </div>
          ))}
      </PageHeader>

      <details className="group rounded-[18px] bg-surface p-4 shadow-[0_6px_16px_-8px_var(--color-ink)]">
        <summary className="cursor-pointer text-sm font-extrabold text-text marker:content-none">
          <span className="inline-flex items-center gap-1">
            Details
            <span className="text-text-muted transition-transform group-open:rotate-180">▾</span>
          </span>
        </summary>
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm font-bold text-text">
            <span>Total invited</span>
            <span>{totalHeadcount}</span>
          </div>
          {RSVP_FILTERS.map((f) => (
            <div key={f.value} className="flex items-center justify-between text-xs font-semibold text-text-muted">
              <span>{f.label}</span>
              <span>{statusCounts[f.value]}</span>
            </div>
          ))}
          <p className="mt-1 text-[11px] font-semibold text-text-muted">
            Counts include each attendee&apos;s additional guests.
          </p>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/events/${event.id}/attendees`}
          scroll={false}
          className={cn(
            "rounded-pill px-2.5 py-1 text-[11px] font-extrabold",
            !activeStatus ? "bg-primary-soft text-primary" : "border-2 border-border bg-surface text-text-muted",
          )}
        >
          All
        </Link>
        {RSVP_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/events/${event.id}/attendees?status=${f.value}`}
            scroll={false}
            className={cn(
              "rounded-pill px-2.5 py-1 text-[11px] font-extrabold",
              activeStatus === f.value ? "bg-primary-soft text-primary" : "border-2 border-border bg-surface text-text-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <StaggerList className="flex flex-col gap-2">
        {visibleAttendees.length > 0 ? (
          visibleAttendees.map((a) => (
            <StaggerItem key={a.id}>
              <AttendeeRow attendee={a} eventId={event.id} canEdit={access.isEditor} />
            </StaggerItem>
          ))
        ) : !activeStatus && access.isEditor ? (
          <LinkCard href={`/events/${event.id}/attendees/add`}>
            <p className="text-sm font-semibold text-text-muted">No attendees yet — tap to add one.</p>
          </LinkCard>
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">
              {activeStatus ? "No attendees match that filter." : "No attendees yet."}
            </p>
          </Card>
        )}
      </StaggerList>
    </main>
  );
}
