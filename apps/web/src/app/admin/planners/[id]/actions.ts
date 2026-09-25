"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({
  profileId: z.string().uuid(),
  displayName: z.string().trim().max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export interface EditPlannerState {
  error?: string;
  success?: boolean;
}

// A direct edit, not a request the planner has to approve — "edit records
// directly when a support situation calls for it" is explicit scope for
// this console (see docs/gather_web_admin_architecture.md's Context). Every
// admin mutation writes an audit row; this one records the prior values so
// a later reviewer can see exactly what changed, not just that something did.
export async function editPlanner(_prevState: EditPlannerState, formData: FormData): Promise<EditPlannerState> {
  const { userId } = await requireAdmin();

  const parsed = schema.safeParse({
    profileId: formData.get("profileId"),
    displayName: formData.get("displayName"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the details." };
  }

  const { profileId, displayName, phone } = parsed.data;
  const service = createServiceClient();

  const { data: before } = await service
    .from("profiles")
    .select("display_name, phone")
    .eq("id", profileId)
    .maybeSingle();

  const { error } = await service
    .from("profiles")
    .update({ display_name: displayName || null, phone: phone || null })
    .eq("id", profileId);

  if (error) {
    return { error: "Something went wrong saving those changes." };
  }

  await logAdminAction({
    adminId: userId,
    action: "profile.edited",
    targetTable: "profiles",
    targetId: profileId,
    detail: { before, after: { display_name: displayName || null, phone: phone || null } },
  });

  revalidatePath(`/admin/planners/${profileId}`);
  return { success: true };
}
