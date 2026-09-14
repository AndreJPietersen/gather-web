import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card, LinkCard } from "@/components/ui/card";
import { formatEventDateTime } from "@/lib/utils";
import { EditPlannerForm } from "./edit-planner-form";

interface PlannerDetail {
  id: string;
  display_name: string | null;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
}

interface OwnedEventRow {
  id: string;
  name: string;
  status: string;
  start_at: string;
}

interface CollaborationRow {
  id: string;
  permission_level: string;
  status: string;
  events: { id: string; name: string } | null;
}

interface VendorMembershipRow {
  id: string;
  role: string;
  vendors: { id: string; name: string } | null;
}

interface CaseRow {
  id: string;
  subject: string;
  status: string;
  created_at: string;
}

export default async function AdminPlannerDetailPage({ params }: PageProps<"/admin/planners/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const service = createServiceClient();

  const { data: planner } = await service
    .from("profiles")
    .select("id, display_name, phone, is_admin, created_at")
    .eq("id", id)
    .maybeSingle<PlannerDetail>();

  if (!planner) {
    notFound();
  }

  const [{ data: ownedEvents }, { data: collaborations }, { data: vendorMemberships }, { data: cases }] = await Promise.all([
    service
      .from("events")
      .select("id, name, status, start_at")
      .eq("owner_id", id)
      .order("start_at", { ascending: false })
      .returns<OwnedEventRow[]>(),
    service
      .from("event_collaborators")
      .select("id, permission_level, status, events(id, name)")
      .eq("user_id", id)
      .returns<CollaborationRow[]>(),
    service
      .from("vendor_team_members")
      .select("id, role, vendors(id, name)")
      .eq("user_id", id)
      .eq("is_active", true)
      .returns<VendorMembershipRow[]>(),
    service
      .from("support_cases")
      .select("id, subject, status, created_at")
      .eq("requester_id", id)
      .order("created_at", { ascending: false })
      .returns<CaseRow[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-ink">{planner.display_name ?? "Unnamed planner"}</h1>
          {planner.is_admin && (
            <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary">
              Admin
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-text-muted">
          Joined {new Date(planner.created_at).toLocaleDateString()}
        </p>
      </div>

      <EditPlannerForm profileId={planner.id} displayName={planner.display_name} phone={planner.phone} />

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Events Owned ({ownedEvents?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {ownedEvents && ownedEvents.length > 0 ? (
            ownedEvents.map((event) => (
              <LinkCard key={event.id} href={`/admin/events/${event.id}`} className="flex items-center justify-between">
                <p className="text-sm font-bold text-text">{event.name}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {formatEventDateTime(event.start_at)} · {event.status}
                </p>
              </LinkCard>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No events owned.</p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Collaborations ({collaborations?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {collaborations && collaborations.length > 0 ? (
            collaborations.map((c) => (
              <LinkCard
                key={c.id}
                href={c.events ? `/admin/events/${c.events.id}` : "/admin/events"}
                className="flex items-center justify-between"
              >
                <p className="text-sm font-bold text-text">{c.events?.name ?? "Deleted event"}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {c.permission_level} · {c.status}
                </p>
              </LinkCard>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No collaborations.</p>
            </Card>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Vendor Memberships ({vendorMemberships?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {vendorMemberships && vendorMemberships.length > 0 ? (
            vendorMemberships.map((m) => (
              <LinkCard
                key={m.id}
                href={m.vendors ? `/admin/vendors/${m.vendors.id}` : "/admin/vendors"}
                className="flex items-center justify-between"
              >
                <p className="text-sm font-bold text-text">{m.vendors?.name ?? "Deleted vendor"}</p>
                <p className="text-xs font-semibold text-text-muted">{m.role}</p>
              </LinkCard>
            ))
          ) : (
            <Card>
              <p className="text-sm font-semibold text-text-muted">No vendor memberships.</p>
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
              <p className="text-sm font-semibold text-text-muted">No cases logged for this planner.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
