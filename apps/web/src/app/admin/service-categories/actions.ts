"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

const createSchema = z.object({ name: z.string().trim().min(2, "Name is too short").max(60) });

export interface NewServiceCategoryState {
  error?: string;
}

// Structural mirror of admin/event-types/actions.ts's createEventType — a
// separate taxonomy (Photography, Catering, Music, ...) from event types,
// not the same list: one event type needs several service categories at
// once, so this can't reuse that table.
export async function createServiceCategory(
  _prevState: NewServiceCategoryState,
  formData: FormData,
): Promise<NewServiceCategoryState> {
  const { userId } = await requireAdmin();
  const parsed = createSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the name." };
  }

  const service = createServiceClient();

  const { data: existing } = await service
    .from("service_categories")
    .select("id")
    .ilike("name", parsed.data.name)
    .maybeSingle();
  if (existing) {
    return { error: "A service category with that name already exists." };
  }

  const { data: created, error } = await service
    .from("service_categories")
    .insert({ name: parsed.data.name })
    .select("id")
    .single();
  if (error || !created) {
    return { error: "Something went wrong creating that service category." };
  }

  await logAdminAction({
    adminId: userId,
    action: "service_category.created",
    targetTable: "service_categories",
    targetId: created.id,
    detail: { name: parsed.data.name },
  });

  revalidatePath("/admin/service-categories");
  return {};
}

const toggleSchema = z.object({
  id: z.string().uuid(),
  nextActive: z.enum(["true", "false"]),
});

export async function setServiceCategoryActive(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = toggleSchema.safeParse({
    id: formData.get("id"),
    nextActive: formData.get("nextActive"),
  });
  if (!parsed.success) return;

  const nextActive = parsed.data.nextActive === "true";
  const service = createServiceClient();
  const { error } = await service.from("service_categories").update({ is_active: nextActive }).eq("id", parsed.data.id);
  if (error) return;

  await logAdminAction({
    adminId: userId,
    action: nextActive ? "service_category.reactivated" : "service_category.deactivated",
    targetTable: "service_categories",
    targetId: parsed.data.id,
  });

  revalidatePath("/admin/service-categories");
}
