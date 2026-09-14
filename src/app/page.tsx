import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/session";
import { formatEventDateTime } from "@/lib/utils";

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

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      {session.status === "authenticated" ? (
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
      ) : (
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Gather</h1>
          <p className="mt-1 text-sm font-semibold text-text-muted">Plan it. Book it. Pull it off.</p>
          <div className="mt-4 flex flex-col gap-2">
            <LinkButton href="/register?persona=planner" variant="primary">
              Plan an Event
            </LinkButton>
            <LinkButton href="/register?persona=vendor" variant="secondary">
              List Your Business
            </LinkButton>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Upcoming Events</h2>
        {events && events.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3">
            {events.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`}>
                <Card className="flex flex-col gap-1">
                  <p className="text-sm font-extrabold text-text">{event.name}</p>
                  <p className="text-xs font-semibold text-text-muted">
                    {formatEventDateTime(event.start_at)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="mt-3">
            <p className="text-sm font-semibold text-text-muted">No public events yet — check back soon.</p>
          </Card>
        )}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Vendors</h2>
        {vendors && vendors.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {vendors.map((vendor) => (
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
          <Card className="mt-3">
            <p className="text-sm font-semibold text-text-muted">No verified vendors yet — check back soon.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
