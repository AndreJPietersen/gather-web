import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMaxOwnedBusinesses } from "@/lib/app-settings";
import { approveBusinessRequest, rejectBusinessRequest } from "./actions";

interface RequestRow {
  id: string;
  requester_id: string;
  business_name: string;
  primary_category: string | null;
  needs_extra_slot: boolean;
  needs_duplicate_category: boolean;
  reason: string | null;
  created_at: string;
  requester: { display_name: string | null } | null;
}

interface OwnerRow {
  user_id: string;
  vendors: { id: string; name: string; primary_category: string | null } | null;
}

// Exception requests from users who hit an owner rule while adding a
// business (see src/lib/vendor-business-rules.ts). Each card shows what the
// requester already owns, since that's what the decision turns on.
export default async function AdminBusinessRequestsPage() {
  await requireAdmin();
  const service = createServiceClient();
  const maxOwned = await getMaxOwnedBusinesses();

  const { data: requests } = await service
    .from("vendor_business_requests")
    .select(
      "id, requester_id, business_name, primary_category, needs_extra_slot, needs_duplicate_category, reason, created_at, requester:profiles!vendor_business_requests_requester_id_profiles_id_fk(display_name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<RequestRow[]>();

  const requesterIds = Array.from(new Set((requests ?? []).map((r) => r.requester_id)));
  const { data: ownerRows } =
    requesterIds.length > 0
      ? await service
          .from("vendor_team_members")
          .select("user_id, vendors(id, name, primary_category)")
          .in("user_id", requesterIds)
          .eq("role", "owner")
          .eq("is_active", true)
          .returns<OwnerRow[]>()
      : { data: [] as OwnerRow[] };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-ink">Business Requests</h1>
        <p className="text-sm font-semibold text-text-muted">
          Users can own up to {maxOwned} businesses, one per category. Approving lets the requester create
          this one business through the normal form; it doesn&apos;t create it for them.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {requests && requests.length > 0 ? (
          requests.map((r) => {
            const owned = (ownerRows ?? []).filter((o) => o.user_id === r.requester_id && o.vendors);
            const needs = [
              r.needs_extra_slot && `over the ${maxOwned}-business limit`,
              r.needs_duplicate_category && `a second ${r.primary_category ?? "same-category"} business`,
            ].filter(Boolean);
            return (
              <Card key={r.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-text">
                    {r.business_name}
                    {r.primary_category && <span className="font-semibold text-text-muted"> · {r.primary_category}</span>}
                  </p>
                  <p className="text-xs font-semibold text-text-muted">{new Date(r.created_at).toLocaleDateString("en-ZA")}</p>
                </div>
                <p className="text-xs font-semibold text-text-muted">
                  Requested by{" "}
                  <Link href={`/admin/planners/${r.requester_id}`} className="font-extrabold text-primary">
                    {r.requester?.display_name ?? "Unknown"}
                  </Link>{" "}
                  — needs {needs.join(" and ")}
                </p>
                <p className="text-xs font-semibold text-text-muted">
                  Already owns ({owned.length}):{" "}
                  {owned.length > 0
                    ? owned.map((o) => `${o.vendors!.name}${o.vendors!.primary_category ? ` (${o.vendors!.primary_category})` : ""}`).join(", ")
                    : "nothing"}
                </p>
                {r.reason && <p className="text-sm font-semibold text-text">&ldquo;{r.reason}&rdquo;</p>}
                <div className="flex items-center gap-2">
                  <form action={approveBusinessRequest}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <Button type="submit" variant="primary">
                      Approve
                    </Button>
                  </form>
                  <form action={rejectBusinessRequest} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="requestId" value={r.id} />
                    <Input name="reason" placeholder="Reason (optional)" className="flex-1" />
                    <Button type="submit" variant="secondary">
                      Reject
                    </Button>
                  </form>
                </div>
              </Card>
            );
          })
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No business requests waiting.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
