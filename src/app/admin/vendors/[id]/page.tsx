import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card, LinkCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatZAR } from "@/lib/utils";
import { markVendorVerified } from "./actions";

interface VendorDetail {
  id: string;
  name: string;
  primary_category: string | null;
  verification_status: "unclaimed" | "claim_pending" | "verified";
  phone: string | null;
  website: string | null;
  created_at: string;
}

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
}

interface TeamRow {
  id: string;
  role: string;
  profiles: { id: string; display_name: string | null } | null;
}

interface QuoteRow {
  id: string;
  amount: string;
  status: string;
  event_vendors: { events: { id: string; name: string } | null } | null;
}

interface EventVendorRow {
  id: string;
  status: string;
  events: { id: string; name: string } | null;
}

interface CaseRow {
  id: string;
  subject: string;
  status: string;
}

export default async function AdminVendorDetailPage({ params }: PageProps<"/admin/vendors/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const service = createServiceClient();

  const { data: vendor } = await service
    .from("vendors")
    .select("id, name, primary_category, verification_status, phone, website, created_at")
    .eq("id", id)
    .maybeSingle<VendorDetail>();

  if (!vendor) {
    notFound();
  }

  const [{ data: services }, { data: team }, { data: eventAssociations }, { data: cases }] = await Promise.all([
    service.from("vendor_services").select("id, name, description").eq("vendor_id", id).returns<ServiceRow[]>(),
    service
      .from("vendor_team_members")
      .select("id, role, profiles(id, display_name)")
      .eq("vendor_id", id)
      .eq("is_active", true)
      .returns<TeamRow[]>(),
    service
      .from("event_vendors")
      .select("id, status, events(id, name)")
      .eq("vendor_id", id)
      .returns<EventVendorRow[]>(),
    service.from("support_cases").select("id, subject, status").eq("related_vendor_id", id).returns<CaseRow[]>(),
  ]);

  // vendor_quotes has no direct vendor_id column (it's keyed off
  // event_vendor_id) — go through the event_vendors already fetched above
  // rather than relying on filtering-through-an-embed syntax.
  const eventVendorIds = (eventAssociations ?? []).map((ev) => ev.id);
  const { data: quotes } =
    eventVendorIds.length > 0
      ? await service
          .from("vendor_quotes")
          .select("id, amount, status, event_vendors(events(id, name))")
          .in("event_vendor_id", eventVendorIds)
          .returns<QuoteRow[]>()
      : { data: [] as QuoteRow[] };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-ink">{vendor.name}</h1>
          <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
            {vendor.verification_status.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm font-semibold text-text-muted">
          {vendor.primary_category ?? "No category"} · {vendor.phone ?? "No phone"}
        </p>
      </div>

      {vendor.verification_status !== "verified" && (
        <form action={markVendorVerified}>
          <input type="hidden" name="vendorId" value={vendor.id} />
          <Button type="submit" variant="secondary">
            Mark Verified
          </Button>
        </form>
      )}

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Services ({services?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {services && services.length > 0 ? (
            services.map((s) => (
              <Card key={s.id}>
                <p className="text-sm font-bold text-text">{s.name}</p>
                {s.description && <p className="text-xs font-semibold text-text-muted">{s.description}</p>}
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No services listed.</p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Team ({team?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {team && team.length > 0 ? (
            team.map((m) => (
              <LinkCard
                key={m.id}
                href={m.profiles ? `/admin/planners/${m.profiles.id}` : "/admin/planners"}
                className="flex items-center justify-between"
              >
                <p className="text-sm font-bold text-text">{m.profiles?.display_name ?? "Unknown"}</p>
                <p className="text-xs font-semibold text-text-muted">{m.role}</p>
              </LinkCard>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No team members.</p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Quotes ({quotes?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {quotes && quotes.length > 0 ? (
            quotes.map((q) => (
              <Card key={q.id} className="flex items-center justify-between">
                <p className="text-sm font-bold text-text">{q.event_vendors?.events?.name ?? "Unknown event"}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {formatZAR(Number(q.amount))} · {q.status}
                </p>
              </Card>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No quotes submitted.</p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Event Associations ({eventAssociations?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {eventAssociations && eventAssociations.length > 0 ? (
            eventAssociations.map((ev) => (
              <LinkCard
                key={ev.id}
                href={ev.events ? `/admin/events/${ev.events.id}` : "/admin/events"}
                className="flex items-center justify-between"
              >
                <p className="text-sm font-bold text-text">{ev.events?.name ?? "Unknown event"}</p>
                <p className="text-xs font-semibold text-text-muted">{ev.status}</p>
              </LinkCard>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No event associations.</p>
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
              <p className="text-sm font-semibold text-text-muted">No cases logged for this vendor.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
