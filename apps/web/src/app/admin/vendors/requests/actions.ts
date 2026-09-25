"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

const approveSchema = z.object({ requestId: z.string().uuid() });

// Approving doesn't create the business — it lets the requester create that
// one business themselves through the normal form (registerVendorBusiness
// spends the approval, status → used). That keeps a single creation path
// and leaves the details (description, phone, ...) to the person who knows
// them.
export async function approveBusinessRequest(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = approveSchema.safeParse({ requestId: formData.get("requestId") });
  if (!parsed.success) return;

  const service = createServiceClient();
  const { error } = await service
    .from("vendor_business_requests")
    .update({ status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.requestId)
    .eq("status", "pending");
  if (error) return;

  await logAdminAction({
    adminId: userId,
    action: "vendor_business_request.approved",
    targetTable: "vendor_business_requests",
    targetId: parsed.data.requestId,
  });
  revalidatePath("/admin/vendors/requests");
  revalidatePath("/admin");
}

const rejectSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function rejectBusinessRequest(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = rejectSchema.safeParse({ requestId: formData.get("requestId"), reason: formData.get("reason") });
  if (!parsed.success) return;

  const service = createServiceClient();
  const { error } = await service
    .from("vendor_business_requests")
    .update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: parsed.data.reason || null,
    })
    .eq("id", parsed.data.requestId)
    .eq("status", "pending");
  if (error) return;

  await logAdminAction({
    adminId: userId,
    action: "vendor_business_request.rejected",
    targetTable: "vendor_business_requests",
    targetId: parsed.data.requestId,
  });
  revalidatePath("/admin/vendors/requests");
  revalidatePath("/admin");
}
