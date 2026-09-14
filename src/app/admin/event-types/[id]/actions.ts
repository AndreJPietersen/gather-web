"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

const linkSchema = z.object({
  eventTypeId: z.string().uuid(),
  serviceCategoryId: z.string().uuid(),
});

// Fire-and-forget, per-row, immediate-submit — matching this codebase's own
// established idiom for row-level toggles (removeService, removeSocialLink,
// etc.), not a checkbox-grid-with-batch-save. The mapping table has a
// composite primary key on exactly these two ids, so there's no separate
// row id to track.
export async function linkServiceCategory(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = linkSchema.safeParse({
    eventTypeId: formData.get("eventTypeId"),
    serviceCategoryId: formData.get("serviceCategoryId"),
  });
  if (!parsed.success) return;

  const service = createServiceClient();
  const { error } = await service.from("event_type_service_categories").insert({
    event_type_id: parsed.data.eventTypeId,
    service_category_id: parsed.data.serviceCategoryId,
  });
  if (error) return;

  await logAdminAction({
    adminId: userId,
    action: "event_type_service_category.linked",
    targetTable: "event_type_service_categories",
    targetId: null,
    detail: parsed.data,
  });

  revalidatePath(`/admin/event-types/${parsed.data.eventTypeId}`);
}

export async function unlinkServiceCategory(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = linkSchema.safeParse({
    eventTypeId: formData.get("eventTypeId"),
    serviceCategoryId: formData.get("serviceCategoryId"),
  });
  if (!parsed.success) return;

  const service = createServiceClient();
  const { error } = await service
    .from("event_type_service_categories")
    .delete()
    .eq("event_type_id", parsed.data.eventTypeId)
    .eq("service_category_id", parsed.data.serviceCategoryId);
  if (error) return;

  await logAdminAction({
    adminId: userId,
    action: "event_type_service_category.unlinked",
    targetTable: "event_type_service_categories",
    targetId: null,
    detail: parsed.data,
  });

  revalidatePath(`/admin/event-types/${parsed.data.eventTypeId}`);
}
