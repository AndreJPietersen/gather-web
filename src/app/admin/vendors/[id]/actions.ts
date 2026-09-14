"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

const verifySchema = z.object({ vendorId: z.string().uuid() });

// Per docs/gather_web_admin_architecture.md's Vendor Directory Bootstrapping
// section: "An admin can also mark a vendor Verified directly, without a
// claim, for hand-onboarded vendors" — a separate path from the claim-queue
// approval flow in ../claims/actions.ts, for vendors an admin adds/confirms
// by other means (a phone call, an in-person signup) rather than a
// self-service claim.
export async function markVendorVerified(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = verifySchema.safeParse({ vendorId: formData.get("vendorId") });
  if (!parsed.success) return;

  const service = createServiceClient();
  const { error } = await service
    .from("vendors")
    .update({ verification_status: "verified" })
    .eq("id", parsed.data.vendorId);

  if (!error) {
    await logAdminAction({
      adminId: userId,
      action: "vendor.verified_directly",
      targetTable: "vendors",
      targetId: parsed.data.vendorId,
    });
    revalidatePath(`/admin/vendors/${parsed.data.vendorId}`);
  }
}
