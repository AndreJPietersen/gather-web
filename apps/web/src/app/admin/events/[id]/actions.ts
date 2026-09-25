"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({ eventId: z.string().uuid() });

// A moderation action — per docs/gather_web_admin_architecture.md's Route
// Inventory ("moderation actions (e.g. cancel)"). Sets status only; doesn't
// touch attendees/tasks/vendor bookings, matching how the planner's own
// edit-event flow treats status as an independent field.
export async function cancelEventAsAdmin(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = schema.safeParse({ eventId: formData.get("eventId") });
  if (!parsed.success) return;

  const service = createServiceClient();
  const { error } = await service.from("events").update({ status: "cancelled" }).eq("id", parsed.data.eventId);

  if (!error) {
    await logAdminAction({
      adminId: userId,
      action: "event.cancelled",
      targetTable: "events",
      targetId: parsed.data.eventId,
    });
    revalidatePath(`/admin/events/${parsed.data.eventId}`);
  }
}
