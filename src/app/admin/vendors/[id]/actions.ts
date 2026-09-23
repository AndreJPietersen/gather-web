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

const featuredSchema = z.object({ vendorId: z.string().uuid(), featured: z.enum(["true", "false"]) });

// The paid-placement-style boost behind the vendor marketplace redesign —
// deliberately admin-only, not something a vendor can set on their own
// edit form: vendors.is_featured has its own column-level UPDATE grant
// (supabase/migrations/00000000000015_...) that excludes `authenticated`
// entirely, so this is the only real write path regardless of what any
// future UI might try to send.
export async function toggleVendorFeatured(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = featuredSchema.safeParse({ vendorId: formData.get("vendorId"), featured: formData.get("featured") });
  if (!parsed.success) return;

  const service = createServiceClient();
  const isFeatured = parsed.data.featured === "true";
  const { error } = await service.from("vendors").update({ is_featured: isFeatured }).eq("id", parsed.data.vendorId);

  if (!error) {
    await logAdminAction({
      adminId: userId,
      action: isFeatured ? "vendor.featured" : "vendor.unfeatured",
      targetTable: "vendors",
      targetId: parsed.data.vendorId,
    });
    revalidatePath(`/admin/vendors/${parsed.data.vendorId}`);
    revalidatePath("/vendors");
    revalidatePath("/");
  }
}
