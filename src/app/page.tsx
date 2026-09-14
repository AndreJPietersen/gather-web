import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { LinkCard } from "@/components/ui/card";
import { GuestLanding } from "@/components/landing/guest-landing";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/session";
import { formatEventDateTime, formatZAR } from "@/lib/utils";
import { getUpcomingWindow, upcomingCutoffDate } from "@/lib/upcoming";

interface PublicEvent {
  id: string;
  name: string;
  event_type: string | null;
  start_at: string;
  location: string | null;
}

interface VerifiedVendor {
  id: string;
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
    supabase
      .from("vendors")
      .select("id, name, primary_category")
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(4)
      .returns<VerifiedVendor[]>(),
  ]);

  if (session.status !== "authenticated") {
    return <GuestLanding events={events} vendors={vendors} />;
  }

  const upcomingWindow = await getUpcomingWindow(supabase, session.userId);
  const cutoff = upcomingCutoffDate(upcomingWindow);

  // Scoped to the signed-in user's own events, unlike the public
  // events/vendors queries above — RLS (event_tasks/payment_installments'
  // owner-or-collaborator policies) already restricts these to events this
  // user actually owns or collaborates on, so no extra event-id filter is
  // needed here.
  const [{ data: upcomingTasks }, { data: upcomingInstallments }] = await Promise.all([
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
  ]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Welcome back{session.displayName ? `, ${session.displayName}` : ""}
        </h1>
        <p className="mt-1 text-sm font-semibold text-text-muted">Plan your next event or check the directory.</p>
        <div className="mt-4 flex gap-2">
          <LinkButton href="/events" variant="primary" className="flex-1">
            My Events
          </LinkButton>
          <LinkButton href="/vendors" variant="secondary" className="flex-1">
            Vendors
          </LinkButton>
        </div>
      </div>

      {upcomingTasks && upcomingTasks.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Upcoming Tasks</h2>
          <div className="mt-3 flex flex-col gap-2">
            {upcomingTasks.map((task) => (
              <LinkCard key={task.id} href={`/events/${task.event_id}/tasks`} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text">{task.title}</p>
                  <p className="text-xs font-semibold text-text-muted">{task.events?.name ?? "An event"}</p>
                </div>
                <p className="text-xs font-extrabold text-primary">Due {task.due_date}</p>
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
                <LinkCard key={installment.id} href={href} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-text">{eventVendor?.vendors?.name ?? "A vendor"}</p>
                    <p className="text-xs font-semibold text-text-muted">{eventVendor?.events?.name ?? "An event"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-text">{formatZAR(installment.amount)}</p>
                    <p className={`text-xs font-extrabold ${installment.status === "late" ? "text-primary" : "text-text-muted"}`}>
                      {installment.status === "late" ? "Overdue" : `Due ${installment.due_date}`}
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
          <div className="mt-3 flex flex-col gap-3">
            {events.map((event) => (
              <LinkCard key={event.id} href={`/events/${event.id}`}>
                <p className="text-sm font-extrabold text-text">{event.name}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {formatEventDateTime(event.start_at)}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </LinkCard>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-text-muted">No public events yet — check back soon.</p>
        )}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Vendors</h2>
        {vendors && vendors.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {vendors.map((vendor) => (
              // Plain Link, not LinkCard: this is a small pill tag, not a
              // card, and LinkCard's own base classes (rounded-[22px], p-4,
              // a shadow) fight a rounded-pill/px-3/py-1.5 override here —
              // tailwind-merge doesn't know the project's arbitrary-value
              // radius utilities conflict with each other, so both survived
              // and broke the pill's shape. Found in code review.
              <Link
                key={vendor.id}
                href={`/vendors/${vendor.id}`}
                className="rounded-pill bg-primary-soft px-3 py-1.5 text-xs font-extrabold text-primary"
              >
                {vendor.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-text-muted">No verified vendors yet — check back soon.</p>
        )}
      </div>
    </main>
  );
}
