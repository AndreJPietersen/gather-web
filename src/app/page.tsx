import Link from "next/link";
import { ListTodo, Wallet, CalendarDays } from "lucide-react";
import { LinkCard } from "@/components/ui/card";
import { VendorAvatar } from "@/components/vendor/vendor-avatar";
import { VendorRatingBadge } from "@/components/vendor/vendor-rating-badge";
import { GuestLanding } from "@/components/landing/guest-landing";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/session";
import { formatEventDateTime, formatZAR } from "@/lib/utils";
import { getUpcomingWindow, upcomingCutoffDate, isInstallmentOverdue } from "@/lib/upcoming";
import { rankVendors, type RankableVendor } from "@/lib/vendor-ranking";
import { getVendorRatingSummaries } from "@/lib/vendor-reviews";

interface PublicEvent {
  id: string;
  name: string;
  event_type: string | null;
  start_at: string;
  location: string | null;
}

interface TeaserVendor extends RankableVendor {
  name: string;
  primary_category: string | null;
}

interface UpcomingTask {
  id: string;
  title: string;
  due_date: string;
  event_id: string;
  events: { name: string } | null;
}

interface UpcomingInstallment {
  id: string;
  due_date: string;
  amount: string;
  status: "pending" | "late" | "paid" | "cancelled";
  payment_plans: {
    event_vendor_id: string;
    event_vendors: {
      event_id: string;
      events: { name: string } | null;
      vendors: { name: string } | null;
    } | null;
  } | null;
}

// The real guest Home — replaces Phase 1's style-proof page. Branches on
// auth state (never done once across the whole Salesforce-era LWC build,
// explicitly called out in docs/gather_web_architecture.md as a gap to
// actually close this time) and exercises the anon-role RLS policies on
// `events` and `vendors` first, per Phase 3's "riskiest part first"
// sequencing.
export default async function Home() {
  const supabase = await createClient();
  const [session, { data: events }, { data: vendors }] = await Promise.all([
    getSessionContext(),
    supabase
      .from("events")
      .select("id, name, event_type, start_at, location")
      .eq("status", "published")
      .eq("visibility", "public")
      .order("start_at", { ascending: true })
      .limit(6)
      .returns<PublicEvent[]>(),
    // Verified only, unlike the full /vendors marketplace directory (which
    // deliberately also surfaces unclaimed stubs) — Home's teaser is meant
    // to be a trust-building highlight reel ("book vendors you can trust,"
    // the guest landing page's own pitch), not the place an unreviewed stub
    // gets its first exposure.
    supabase
      .from("vendors")
      .select("id, name, primary_category, verification_status, is_featured, logo_path, description, created_at")
      .eq("verification_status", "verified")
      .returns<TeaserVendor[]>(),
  ]);

  const rankedVendors = (await rankVendors(supabase, vendors ?? [])).slice(0, 6);
  const vendorLogoUrls = new Map(
    rankedVendors
      .filter((v) => v.logo_path)
      .map((v) => [v.id, supabase.storage.from("vendor-logos").getPublicUrl(v.logo_path!).data.publicUrl]),
  );
  const vendorRatingSummaries = await getVendorRatingSummaries(
    supabase,
    rankedVendors.map((v) => v.id),
  );

  if (session.status !== "authenticated") {
    return (
      <GuestLanding events={events} vendors={rankedVendors} vendorLogoUrls={vendorLogoUrls} vendorRatingSummaries={vendorRatingSummaries} />
    );
  }

  const upcomingWindow = await getUpcomingWindow(supabase, session.userId);
  const cutoff = upcomingCutoffDate(upcomingWindow);

  // Scoped to the signed-in user's own events, unlike the public
  // events/vendors queries above — RLS (event_tasks/payment_installments'
  // owner-or-collaborator policies) already restricts these to events this
  // user actually owns or collaborates on, so no extra event-id filter is
  // needed here.
  const [{ data: upcomingTasks }, { data: upcomingInstallments }, { data: ownedEvents }, { data: collabEvents }] =
    await Promise.all([
      supabase
        .from("event_tasks")
        .select("id, title, due_date, event_id, events(name)")
        .eq("completed", false)
        .not("due_date", "is", null)
        .lte("due_date", cutoff)
        .order("due_date", { ascending: true })
        .limit(10)
        .returns<UpcomingTask[]>(),
      supabase
        .from("payment_installments")
        .select(
          "id, due_date, amount, status, payment_plans(event_vendor_id, event_vendors(event_id, events(name), vendors(name)))",
        )
        .in("status", ["pending", "late"])
        .lte("due_date", cutoff)
        .order("due_date", { ascending: true })
        .limit(10)
        .returns<UpcomingInstallment[]>(),
      // Feeds the "Events" quick-stat on the hero card only — a plain count
      // of events this user has any real relationship to (owns, or is an
      // accepted collaborator on), unioned by id since the two are separate
      // tables and a user could in principle appear in both.
      supabase.from("events").select("id").eq("owner_id", session.userId).returns<{ id: string }[]>(),
      supabase
        .from("event_collaborators")
        .select("event_id")
        .eq("user_id", session.userId)
        .eq("status", "accepted")
        .returns<{ event_id: string }[]>(),
    ]);

  const eventsCount = new Set([
    ...(ownedEvents ?? []).map((e) => e.id),
    ...(collabEvents ?? []).map((c) => c.event_id),
  ]).size;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      {/* "Icon rows + gradient hero" — the fuller-pop direction Andre picked
          off the UI-polish canvas, reusing the countdown card's exact
          glass-tiles-on-gradient language (docs/gather_web_architecture.md,
          teachAndre/12) for the greeting instead of a plain text block. */}
      <div className="flex flex-col gap-4 rounded-[26px] bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-glow))] p-6 shadow-[0_10px_24px_-10px_var(--color-primary)]">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-[1.2] text-white">
            Welcome back{session.displayName ? `, ${session.displayName}` : ""}
          </h1>
          <p className="mt-1 text-sm font-bold text-white/85">Plan your next event or check the directory.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[14px] border border-white/30 bg-white/15 px-3 py-3 text-center">
            <p className="font-display text-[22px] font-semibold text-white">{eventsCount}</p>
            <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white/85">Events</p>
          </div>
          <div className="rounded-[14px] border border-white/30 bg-white/15 px-3 py-3 text-center">
            <p className="font-display text-[22px] font-semibold text-white">{upcomingTasks?.length ?? 0}</p>
            <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white/85">Tasks due</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/events"
            className="flex-1 rounded-pill bg-white px-6 py-3.5 text-center text-[14.5px] font-extrabold text-primary"
          >
            My Events
          </Link>
          <Link
            href="/vendors"
            className="flex-1 rounded-pill border-2 border-white/40 bg-white/15 px-6 py-3.5 text-center text-[14.5px] font-extrabold text-white"
          >
            Vendors
          </Link>
        </div>
      </div>

      {upcomingTasks && upcomingTasks.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Upcoming Tasks</h2>
          <div className="mt-3 flex flex-col gap-2">
            {upcomingTasks.map((task) => (
              <LinkCard key={task.id} href={`/events/${task.event_id}/tasks`} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-secondary-soft">
                  <ListTodo size={20} strokeWidth={2} className="text-ink" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text">{task.title}</p>
                  <p className="truncate text-xs font-semibold text-text-muted">{task.events?.name ?? "An event"}</p>
                </div>
                <p className="shrink-0 text-xs font-extrabold text-primary">Due {task.due_date}</p>
              </LinkCard>
            ))}
          </div>
        </div>
      )}

      {upcomingInstallments && upcomingInstallments.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Upcoming Payments</h2>
          <div className="mt-3 flex flex-col gap-2">
            {upcomingInstallments.map((installment) => {
              const eventVendor = installment.payment_plans?.event_vendors;
              const href = eventVendor
                ? `/events/${eventVendor.event_id}/payments?vendor=${installment.payment_plans?.event_vendor_id}`
                : "/events";
              return (
                <LinkCard key={installment.id} href={href} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary-soft">
                    <Wallet size={20} strokeWidth={2} className="text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-text">{eventVendor?.vendors?.name ?? "A vendor"}</p>
                    <p className="truncate text-xs font-semibold text-text-muted">{eventVendor?.events?.name ?? "An event"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-extrabold text-text">{formatZAR(installment.amount)}</p>
                    <p
                      className={`text-xs font-extrabold ${isInstallmentOverdue(installment.status, installment.due_date) ? "text-primary" : "text-text-muted"}`}
                    >
                      {isInstallmentOverdue(installment.status, installment.due_date) ? "Overdue" : `Due ${installment.due_date}`}
                    </p>
                  </div>
                </LinkCard>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Discover Public Events</h2>
        <p className="mt-0.5 text-xs font-semibold text-text-muted">
          Open to everyone on Gather — not your own events. Find those under My Events.
        </p>
        {events && events.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {events.map((event) => (
              <LinkCard key={event.id} href={`/events/${event.id}`} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-success-soft">
                  <CalendarDays size={20} strokeWidth={2} className="text-success" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-text">{event.name}</p>
                  <p className="truncate text-xs font-semibold text-text-muted">
                    {formatEventDateTime(event.start_at)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
              </LinkCard>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-text-muted">No public events yet — check back soon.</p>
        )}
      </div>

      {/* Compact, scaled down deliberately (Andre's own call after seeing
          the first pass too big) — this is a taste of the vendor
          marketplace, not the main event, with a "See all" link doing the
          real work of pointing at /vendors for actual browsing. Featured
          vendors (admin-curated) get a bigger gradient card with a ribbon;
          everyone else stays a small plain card in the same row — that
          size difference IS the "compete for a spot" mechanic. */}
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Vendors for you</h2>
          <Link href="/vendors" className="flex items-center gap-0.5 text-xs font-extrabold text-primary">
            See all
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </Link>
        </div>
        {rankedVendors.length > 0 ? (
          <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
            {rankedVendors.map((vendor) =>
              vendor.is_featured ? (
                <LinkCard
                  key={vendor.id}
                  href={`/vendors/${vendor.id}`}
                  className="flex w-32 shrink-0 flex-col gap-3 rounded-[20px] p-3 text-white"
                  style={{ background: "linear-gradient(135deg, oklch(62% 0.18 340), oklch(66% 0.16 5))" }}
                >
                  <span className="flex w-fit items-center gap-1 rounded-pill bg-white/90 px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-ink">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="var(--color-ink)">
                      <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2"></polygon>
                    </svg>
                    Featured
                  </span>
                  <VendorAvatar
                    name={vendor.name}
                    category={vendor.primary_category}
                    verified
                    logoUrl={vendorLogoUrls.get(vendor.id) ?? null}
                    size={34}
                    radius={11}
                  />
                  <div>
                    <p className="truncate text-xs font-extrabold leading-tight">{vendor.name}</p>
                    {vendor.primary_category && <p className="truncate text-[9px] font-bold text-white/85">{vendor.primary_category}</p>}
                  </div>
                  {vendorRatingSummaries.has(vendor.id) && (
                    <VendorRatingBadge
                      average={vendorRatingSummaries.get(vendor.id)!.average}
                      count={vendorRatingSummaries.get(vendor.id)!.count}
                      light
                    />
                  )}
                </LinkCard>
              ) : (
                <LinkCard key={vendor.id} href={`/vendors/${vendor.id}`} className="flex w-28 shrink-0 flex-col gap-2 p-2.5">
                  <VendorAvatar
                    name={vendor.name}
                    category={vendor.primary_category}
                    verified
                    logoUrl={vendorLogoUrls.get(vendor.id) ?? null}
                    size={30}
                    radius={10}
                  />
                  <div>
                    <p className="truncate text-[11px] font-extrabold leading-tight text-text">{vendor.name}</p>
                    {vendor.primary_category && <p className="truncate text-[9px] font-bold text-text-muted">{vendor.primary_category}</p>}
                  </div>
                  {vendorRatingSummaries.has(vendor.id) && (
                    <VendorRatingBadge average={vendorRatingSummaries.get(vendor.id)!.average} count={vendorRatingSummaries.get(vendor.id)!.count} />
                  )}
                </LinkCard>
              ),
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-text-muted">No verified vendors yet — check back soon.</p>
        )}
      </div>
    </main>
  );
}
