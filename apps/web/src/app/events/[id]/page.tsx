import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, ListTodo, Store, Wallet, PiggyBank, Image as ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateTime, getCountdownRemaining } from "@gather/shared/utils";
import { isInstallmentOverdue } from "@/lib/upcoming";
import { getEventPlanningProgress } from "@gather/shared/event-planning-progress";
import { getSuggestedVendorsForEvent } from "@/lib/vendor-suggestions";
import { RsvpForm } from "./rsvp-form";
import { InviteCollaboratorForm } from "./invite-collaborator-form";
import { CountdownCard } from "./countdown-card";
import { getEventAccess } from "./access";
import { HelpMePlanCard } from "./help-me-plan/help-me-plan-card";
import { MoodBoardPreviewCard } from "./mood-board/mood-board-preview-card";

interface EventDetail {
  id: string;
  owner_id: string;
  name: string;
  event_type: string | null;
  event_type_id: string | null;
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
    .select("id, owner_id, name, event_type, event_type_id, start_at, location, description, capacity, status")
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
  // vendorIds (as opposed to evIds, the event_vendors row ids) is only used
  // below by the Help Me Plan block, to exclude already-associated vendors
  // from its own suggestions — fetched here alongside id rather than as a
  // second query, since this one already runs for every management view.
  // Excludes 'rejected' — the same filter the standalone Vendors page
  // applies to its own list, for the same reason: a soft-removed vendor
  // shouldn't count as "you have a vendor" for Help Me Plan's progress, stay
  // permanently excluded from its suggestions, or keep an overdue-payment
  // badge alive for a booking that's no longer actually part of the event.
  let evIds: string[] = [];
  let vendorIds: string[] = [];
  let pIds: string[] = [];
  // Ordered oldest-first and carrying vendors(name) so the Help Me Plan
  // block below can derive its "first vendor added" straight from this
  // array instead of running a second, near-identical event_vendors query.
  let orderedEventVendors: { id: string; vendor_id: string; vendors: { name: string } | null }[] = [];
  if (isManagementView) {
    const { data: eventVendorRows } = await supabase
      .from("event_vendors")
      .select("id, vendor_id, vendors(name)")
      .eq("event_id", event.id)
      .neq("status", "rejected")
      .order("created_at", { ascending: true })
      .returns<{ id: string; vendor_id: string; vendors: { name: string } | null }[]>();
    orderedEventVendors = eventVendorRows ?? [];
    evIds = orderedEventVendors.map((ev) => ev.id);
    vendorIds = orderedEventVendors.map((ev) => ev.vendor_id);
    if (evIds.length > 0) {
      const { data: planIds } = await supabase.from("payment_plans").select("id").in("event_vendor_id", evIds);
      pIds = (planIds ?? []).map((p) => p.id);
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

  // Help Me Plan — editor-only, same gate every add-form on this event's
  // sub-pages already uses (a Viewer collaborator can't write any of these
  // rows under RLS, so there's nothing for the wizard to do for them).
  let planningProgress: ReturnType<typeof getEventPlanningProgress> | null = null;
  let budgetCategories: { id: string; name: string }[] = [];
  let suggestedVendorsForWizard: { id: string; name: string; primary_category: string | null }[] = [];
  let initialBudgetItems: { id: string; label: string }[] = [];
  let initialEventVendor: { id: string; name: string } | null = null;

  if (access.isEditor) {
    const [{ count: attendeeCount }, { count: taskCount }, { data: categories }, { data: existingBudgetItems }, suggestions] =
      await Promise.all([
        supabase.from("event_attendees").select("id", { count: "exact", head: true }).eq("event_id", event.id),
        supabase.from("event_tasks").select("id", { count: "exact", head: true }).eq("event_id", event.id),
        supabase.from("service_categories").select("id, name").eq("is_active", true).order("name"),
        supabase.from("budget_items").select("id, label").eq("event_id", event.id).returns<{ id: string; label: string }[]>(),
        // The exact event_type_service_categories -> vendor_services
        // cross-reference the Vendors sub-page's own "Suggested Vendors"
        // section runs (vendors/page.tsx), via the same shared helper —
        // caps differently (4 here, for one wizard step; 8 there, for a
        // dedicated browsing section), but no longer a second hand-copied
        // query. Started alongside the other 4 queries above rather than
        // after them, since it only needs event.event_type_id and
        // vendorIds, both already known before this Promise.all begins.
        getSuggestedVendorsForEvent(supabase, {
          eventTypeId: event.event_type_id,
          excludeVendorIds: vendorIds,
          limit: 4,
        }),
      ]);

    budgetCategories = categories ?? [];
    initialBudgetItems = existingBudgetItems ?? [];
    suggestedVendorsForWizard = suggestions;
    const firstEventVendor = orderedEventVendors[0] ?? null;
    initialEventVendor = firstEventVendor ? { id: firstEventVendor.id, name: firstEventVendor.vendors?.name ?? "Vendor" } : null;

    planningProgress = getEventPlanningProgress({
      attendeeCount: attendeeCount ?? 0,
      taskCount: taskCount ?? 0,
      // Derived from existingBudgetItems (fetched above with the identical
      // event_id filter) instead of its own separate count query — the two
      // queries had no way to disagree since neither narrows further, so
      // the count query was pure overhead.
      budgetItemCount: initialBudgetItems.length,
      vendorCount: evIds.length,
      paymentPlanCount: pIds.length,
    });
  }

  // Mood board preview strip — visible to the same audience as the board
  // itself (isManagementView, RLS's own owner-or-collaborator read scope),
  // not narrowed to isEditor the way Help Me Plan's card is, since viewing
  // the board doesn't require write access.
  let moodBoardTagline: string | null = null;
  let moodBoardPalette: string[] = [];
  let moodBoardFeaturedPhotos: { id: string; url: string }[] = [];
  // Whether the board has *any* photo, not just a featured one — the
  // preview card's own empty state needs this to avoid claiming a board
  // with real (just unstarred) photos on it is empty.
  let moodBoardHasAnyPhoto = false;
  if (isManagementView) {
    const [{ data: moodBoard }, { data: featuredPhotoRows }, { count: photoCount }] = await Promise.all([
      supabase
        .from("event_mood_boards")
        .select("tagline, palette")
        .eq("event_id", event.id)
        .maybeSingle<{ tagline: string | null; palette: string[] }>(),
      supabase
        .from("event_mood_board_photos")
        .select("id, storage_path")
        .eq("event_id", event.id)
        .eq("is_featured", true)
        .order("featured_at", { ascending: false })
        .limit(2)
        .returns<{ id: string; storage_path: string }[]>(),
      supabase.from("event_mood_board_photos").select("id", { count: "exact", head: true }).eq("event_id", event.id),
    ]);
    moodBoardTagline = moodBoard?.tagline ?? null;
    moodBoardPalette = moodBoard?.palette ?? [];
    moodBoardHasAnyPhoto = (photoCount ?? 0) > 0;

    // One batched request for both featured photos instead of one Storage
    // round trip each.
    if ((featuredPhotoRows ?? []).length > 0) {
      const { data: signedUrls } = await supabase.storage
        .from("event-mood-board")
        .createSignedUrls(
          (featuredPhotoRows ?? []).map((p) => p.storage_path),
          3600,
        );
      const signedUrlByPath = new Map((signedUrls ?? []).filter((e) => e.path && e.signedUrl).map((e) => [e.path as string, e.signedUrl as string]));
      moodBoardFeaturedPhotos = (featuredPhotoRows ?? [])
        .map((photo) => {
          const url = signedUrlByPath.get(photo.storage_path);
          return url ? { id: photo.id, url } : null;
        })
        .filter((p): p is { id: string; url: string } => p !== null);
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

          {access.isEditor && planningProgress && (
            <HelpMePlanCard
              eventId={event.id}
              progress={planningProgress}
              budgetCategories={budgetCategories}
              suggestedVendors={suggestedVendorsForWizard}
              initialBudgetItems={initialBudgetItems}
              initialEventVendor={initialEventVendor}
            />
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

          {isManagementView && (
            <MoodBoardPreviewCard
              eventId={event.id}
              tagline={moodBoardTagline}
              palette={moodBoardPalette}
              featuredPhotos={moodBoardFeaturedPhotos}
              hasAnyPhoto={moodBoardHasAnyPhoto}
            />
          )}

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
