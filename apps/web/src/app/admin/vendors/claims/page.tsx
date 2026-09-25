import { requireAdmin } from "@/lib/admin/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { BackButton } from "@/components/ui/back-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approveClaim, rejectClaim } from "./actions";

interface ClaimRow {
  id: string;
  notes: string | null;
  created_at: string;
  vendors: { id: string; name: string } | null;
  claimant: { id: string; display_name: string | null } | null;
}

export default async function AdminVendorClaimsPage() {
  await requireAdmin();
  const service = createServiceClient();

  const { data: claims } = await service
    .from("vendor_claim_requests")
    .select("id, notes, created_at, vendors(id, name), claimant:profiles!vendor_claim_requests_created_by_profiles_id_fk(id, display_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<ClaimRow[]>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackButton />
        <h1 className="font-display text-2xl font-semibold text-ink">Claim Queue</h1>
        <p className="text-sm font-semibold text-text-muted">
          Approving provisions the claimant as Owner, verifies the vendor, and auto-rejects any other pending claims
          on the same listing.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {claims && claims.length > 0 ? (
          claims.map((claim) => (
            <Card key={claim.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-text">{claim.vendors?.name ?? "Unknown vendor"}</p>
                <p className="text-xs font-semibold text-text-muted">
                  {new Date(claim.created_at).toLocaleDateString()}
                </p>
              </div>
              <p className="text-xs font-semibold text-text-muted">
                Claimant: {claim.claimant?.display_name ?? "Unknown"}
              </p>
              {claim.notes && <p className="text-sm font-semibold text-text">{claim.notes}</p>}
              <div className="flex items-center gap-2">
                <form action={approveClaim}>
                  <input type="hidden" name="claimId" value={claim.id} />
                  <Button type="submit" variant="primary">
                    Approve
                  </Button>
                </form>
                <form action={rejectClaim} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="claimId" value={claim.id} />
                  <Input name="reason" placeholder="Rejection reason (optional)" className="flex-1" />
                  <Button type="submit" variant="secondary">
                    Reject
                  </Button>
                </form>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No pending claims.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
