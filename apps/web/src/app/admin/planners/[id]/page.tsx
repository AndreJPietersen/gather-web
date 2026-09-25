import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card, LinkCard } from "@/components/ui/card";
import { formatEventDateTime } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/button";
import { listingsControlledBy } from "@/lib/admin/moderation";
import { EditPlannerForm } from "./edit-planner-form";
import { SuspendForm } from "./suspend-form";
import { hideUserListingsAction, removeTeamMemberAction, unsuspendUserAction } from "../../moderation/actions";

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
  vendors: { id: string; name: string; hidden_at: string | null } | null;
}

interface SuspensionRow {
  reason: string | null;
  created_at: string;
  admin: { display_name: string | null } | null;
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
      .select("id, role, vendors(id, name, hidden_at)")
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

  const [{ data: suspension }, controlledIds] = await Promise.all([
    service
      .from("user_suspensions")
      .select("reason, created_at, admin:profiles!user_suspensions_suspended_by_profiles_id_fk(display_name)")
      .eq("user_id", id)
      .maybeSingle<SuspensionRow>(),
    listingsControlledBy(id),
  ]);
  const { count: visibleControlled } =
    controlledIds.length > 0
      ? await service.from("vendors").select("id", { count: "exact", head: true }).in("id", controlledIds).is("hidden_at", null)
      : { count: 0 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-ink">{planner.display_name ?? "Unnamed planner"}</h1>
          {suspension && (
            <span className="rounded-pill bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">Suspended</span>
          )}
          {planner.is_admin && (
            <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary">
              Admin
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-text-muted">
            Joined {new Date(planner.created_at).toLocaleDateString()}
          </p>
          <LinkButton href={`/admin/emails/send?userId=${planner.id}`} variant="secondary">
            Email this user
          </LinkButton>
        </div>
      </div>

      <EditPlannerForm profileId={planner.id} displayName={planner.display_name} phone={planner.phone} />

      {/* Moderation — the watchlist's "Review / suspend user" lands here. */}
      <div id="moderation">
        <h2 className="font-display text-lg font-semibold text-ink">Moderation</h2>
        <Card className="mt-3 flex flex-col gap-4">
          {suspension ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold text-ink">
                  Suspended {new Date(suspension.created_at).toLocaleDateString("en-ZA")}
                  {suspension.admin?.display_name ? ` by ${suspension.admin.display_name}` : ""}
                </p>
                <p className="text-sm font-semibold text-text">Reason: {suspension.reason ?? "none given"}</p>
                <p className="text-xs font-semibold text-text-muted">
                  They can&apos;t sign in. Lifting the suspension doesn&apos;t
                  un-hide their listings — restore those one by one from each vendor page.
                </p>
              </div>
              <form action={unsuspendUserAction}>
                <input type="hidden" name="userId" value={planner.id} />
                <Button type="submit" variant="secondary">
                  Lift suspension
                </Button>
              </form>
            </div>
          ) : planner.is_admin ? (
            <p className="text-sm font-semibold text-text-muted">Admins can&apos;t be suspended from here.</p>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-extrabold text-ink">Suspend account</p>
              <p className="text-xs font-semibold text-text-muted">
                Blocks sign-in and rejects their pending claims and business requests. Reversible.
              </p>
              <SuspendForm userId={planner.id} listingCount={visibleControlled ?? 0} />
            </div>
          )}
          {(visibleControlled ?? 0) > 0 && (
            <div className="flex items-center justify-between gap-4 border-t-2 border-border pt-3">
              <p className="text-xs font-semibold text-text-muted">
                {visibleControlled} visible listing{visibleControlled === 1 ? "" : "s"} they control (their unclaimed stubs, and
                businesses they own alone).
              </p>
              <form action={hideUserListingsAction}>
                <input type="hidden" name="userId" value={planner.id} />
                <Button type="submit" variant="secondary">
                  Hide their listings
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>

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
              <div key={m.id} className="flex items-center gap-2">
                <LinkCard
                  href={m.vendors ? `/admin/vendors/${m.vendors.id}` : "/admin/vendors"}
                  className="flex flex-1 items-center justify-between"
                >
                  <p className="text-sm font-bold text-text">
                    {m.vendors?.name ?? "Deleted vendor"}
                    {m.vendors?.hidden_at && <span className="ml-2 text-xs font-extrabold text-primary">Hidden</span>}
                  </p>
                  <p className="text-xs font-semibold text-text-muted">{m.role}</p>
                </LinkCard>
                <form action={removeTeamMemberAction}>
                  <input type="hidden" name="memberId" value={m.id} />
                  <Button type="submit" variant="secondary">
                    Remove
                  </Button>
                </form>
              </div>
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
