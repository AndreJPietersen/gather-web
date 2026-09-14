"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

const claimSchema = z.object({ claimId: z.string().uuid() });

// Approving must: (1) provision the claimant as the vendor's Owner, (2) flip
// the vendor to verified, (3) auto-reject every other competing Pending
// claim on the same vendor — per docs/gather_web_architecture.md's Business
// Rules & Invariants ("Approving a claim auto-rejects every other competing
// Pending claim on the same vendor"), enforced here in the Server Action
// rather than relied on solely from the partial unique index, which only
// blocks a *second approval* — it doesn't clean up the other Pending rows
// left dangling. Multiple sequential writes, not one wrapped transaction
// (supabase-js has no simple multi-statement client transaction) — the same
// accepted tradeoff already made for acceptQuote and vendor self-registration.
export async function approveClaim(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = claimSchema.safeParse({ claimId: formData.get("claimId") });
  if (!parsed.success) return;

  const service = createServiceClient();
  const { data: claim } = await service
    .from("vendor_claim_requests")
    .select("id, vendor_id, created_by, status")
    .eq("id", parsed.data.claimId)
    .maybeSingle();

  if (!claim || claim.status !== "pending") return;

  const { error: approveError } = await service
    .from("vendor_claim_requests")
    .update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", claim.id);
  if (approveError) return;

  // From here on, none of these writes are wrapped in a real transaction —
  // checked explicitly rather than assumed, since silently continuing past
  // a failure here would log "approved" as a success while the documented
  // invariant ("a claimant becomes Owner the moment their claim is
  // approved") silently didn't happen. Found in code review: the previous
  // version ignored every {error} below this point.
  const { error: teamError } = await service.from("vendor_team_members").insert({
    vendor_id: claim.vendor_id,
    user_id: claim.created_by,
    role: "owner",
  });

  if (teamError) {
    // Revert to pending so it's retryable, and log the failure itself —
    // an admin needs to see this happened, not just infer it from a vendor
    // that never got an owner.
    await service.from("vendor_claim_requests").update({ status: "pending" }).eq("id", claim.id);
    await logAdminAction({
      adminId: userId,
      action: "vendor_claim.approve_failed",
      targetTable: "vendor_claim_requests",
      targetId: claim.id,
      detail: { step: "vendor_team_members.insert", error: teamError.message },
    });
    revalidatePath("/admin/vendors/claims");
    return;
  }

  // Owner is provisioned at this point — the invariant that actually
  // matters is satisfied. If verification_status fails to flip, that's a
  // real but lower-severity, independently-recoverable gap (the vendor
  // detail page's own "Mark Verified" button covers it), so log and
  // continue rather than leave the claim stuck with a real Owner already
  // in place.
  const { error: verifyError } = await service
    .from("vendors")
    .update({ verification_status: "verified" })
    .eq("id", claim.vendor_id);
  if (verifyError) {
    await logAdminAction({
      adminId: userId,
      action: "vendor_claim.verify_failed",
      targetTable: "vendors",
      targetId: claim.vendor_id,
      detail: { claimId: claim.id, error: verifyError.message },
    });
  }

  const { error: rejectOthersError } = await service
    .from("vendor_claim_requests")
    .update({ status: "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString(), rejection_reason: "Another claim on this vendor was approved." })
    .eq("vendor_id", claim.vendor_id)
    .eq("status", "pending");
  if (rejectOthersError) {
    console.error("Failed to auto-reject competing claims for vendor", claim.vendor_id, rejectOthersError);
  }

  await logAdminAction({
    adminId: userId,
    action: "vendor_claim.approved",
    targetTable: "vendor_claim_requests",
    targetId: claim.id,
    detail: { vendorId: claim.vendor_id, claimantId: claim.created_by },
  });

  revalidatePath("/admin/vendors/claims");
  revalidatePath(`/admin/vendors/${claim.vendor_id}`);
}

const rejectSchema = z.object({
  claimId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function rejectClaim(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = rejectSchema.safeParse({
    claimId: formData.get("claimId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return;

  const service = createServiceClient();
  const { error } = await service
    .from("vendor_claim_requests")
    .update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: parsed.data.reason || null,
    })
    .eq("id", parsed.data.claimId)
    .eq("status", "pending");

  if (!error) {
    await logAdminAction({
      adminId: userId,
      action: "vendor_claim.rejected",
      targetTable: "vendor_claim_requests",
      targetId: parsed.data.claimId,
    });
    revalidatePath("/admin/vendors/claims");
  }
}
