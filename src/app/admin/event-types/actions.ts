"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

const createSchema = z.object({ name: z.string().trim().min(2, "Name is too short").max(60) });

export interface NewEventTypeState {
  error?: string;
}

// Real, user-facing-validated data entry (a duplicate name needs a friendly
// message, not just a raw unique-constraint failure) — same useActionState
// shape as /admin/cases/new's createCase, unlike the plain fire-and-forget
// forms below for a simple active/inactive flip.
export async function createEventType(_prevState: NewEventTypeState, formData: FormData): Promise<NewEventTypeState> {
  const { userId } = await requireAdmin();
  const parsed = createSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the name." };
  }

  const service = createServiceClient();

  // A friendly duplicate-name check before the insert — the unique index
  // is the real backstop, this is just a nicer error than a raw constraint
  // violation.
  const { data: existing } = await service.from("event_types").select("id").ilike("name", parsed.data.name).maybeSingle();
  if (existing) {
    return { error: "An event type with that name already exists." };
  }

  const { data: created, error } = await service.from("event_types").insert({ name: parsed.data.name }).select("id").single();
  if (error || !created) {
    return { error: "Something went wrong creating that event type." };
  }

  await logAdminAction({
    adminId: userId,
    action: "event_type.created",
    targetTable: "event_types",
    targetId: created.id,
    detail: { name: parsed.data.name },
  });

  revalidatePath("/admin/event-types");
  return {};
}

const promoteSchema = z.object({ name: z.string().trim().min(1).max(60) });

// Turns a free-text "Other" value planners have been typing into a real,
// selectable event type — and backfills every existing event that used
// that exact text (and has no real type yet) to point at the new row, so
// promoting one doesn't leave those events looking unrelated to the type
// they clearly meant. A fire-and-forget button next to each grouped "Other"
// entry on the list page, not a form with its own error display — the
// grouped text itself is the whole input, nothing for a user to get wrong.
export async function promoteOtherType(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = promoteSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return;

  const service = createServiceClient();

  const { data: existing } = await service
    .from("event_types")
    .select("id")
    .ilike("name", parsed.data.name)
    .maybeSingle();

  let eventTypeId = existing?.id as string | undefined;
  if (!eventTypeId) {
    const { data: created, error } = await service
      .from("event_types")
      .insert({ name: parsed.data.name })
      .select("id")
      .single();
    if (error || !created) return;
    eventTypeId = created.id;
  }

  const { data: backfilled, error: backfillError } = await service
    .from("events")
    .update({ event_type_id: eventTypeId })
    .eq("event_type", parsed.data.name)
    .is("event_type_id", null)
    .select("id");

  await logAdminAction({
    adminId: userId,
    action: "event_type.created_from_other",
    targetTable: "event_types",
    targetId: eventTypeId,
    detail: { name: parsed.data.name, backfilledEvents: backfillError ? null : (backfilled?.length ?? 0) },
  });

  revalidatePath("/admin/event-types");
}

const toggleSchema = z.object({
  id: z.string().uuid(),
  nextActive: z.enum(["true", "false"]),
});

export async function setEventTypeActive(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = toggleSchema.safeParse({
    id: formData.get("id"),
    nextActive: formData.get("nextActive"),
  });
  if (!parsed.success) return;

  const nextActive = parsed.data.nextActive === "true";
  const service = createServiceClient();
  const { error } = await service.from("event_types").update({ is_active: nextActive }).eq("id", parsed.data.id);
  if (error) return;

  await logAdminAction({
    adminId: userId,
    action: nextActive ? "event_type.reactivated" : "event_type.deactivated",
    targetTable: "event_types",
    targetId: parsed.data.id,
  });

  revalidatePath("/admin/event-types");
}
