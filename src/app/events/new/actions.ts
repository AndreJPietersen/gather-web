"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sastInputToIso } from "@/lib/utils";
import type { EventFormState } from "../event-form";
import { resolveEventType } from "../resolve-event-type";

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(150),
  eventTypeId: z.string().optional().or(z.literal("")),
  eventTypeOther: z.string().trim().max(60).optional().or(z.literal("")),
  startAt: z.string().min(1, "Start date/time is required"),
  endAt: z.string().optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  visibility: z.enum(["public", "private", "invite_only"]),
  capacity: z.coerce.number().int().min(1).max(100000).optional(),
  budgetTotal: z.coerce.number().min(0).optional(),
  budgetWarningPercent: z.coerce.number().int().min(1).max(100).optional(),
  publish: z.literal("true").optional(),
});

export async function createEvent(_prevState: EventFormState, formData: FormData): Promise<EventFormState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    eventTypeId: formData.get("eventTypeId"),
    eventTypeOther: formData.get("eventTypeOther") || "",
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    location: formData.get("location"),
    description: formData.get("description"),
    visibility: formData.get("visibility"),
    capacity: formData.get("capacity") || undefined,
    budgetTotal: formData.get("budgetTotal") || undefined,
    budgetWarningPercent: formData.get("budgetWarningPercent") || undefined,
    publish: formData.get("publish") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    name,
    eventTypeId,
    eventTypeOther,
    startAt,
    endAt,
    location,
    description,
    visibility,
    capacity,
    budgetTotal,
    budgetWarningPercent,
    publish,
  } = parsed.data;

  const resolvedType = await resolveEventType(supabase, eventTypeId ?? "", eventTypeOther ?? "");
  if (resolvedType.error) {
    return { error: resolvedType.error };
  }

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      owner_id: user.id,
      name,
      event_type: resolvedType.eventType,
      event_type_id: resolvedType.eventTypeId,
      start_at: sastInputToIso(startAt),
      end_at: endAt ? sastInputToIso(endAt) : null,
      location: location || null,
      description: description || null,
      visibility,
      capacity: capacity ?? null,
      budget_total: budgetTotal ?? null,
      budget_warning_percent: budgetWarningPercent ?? null,
      status: publish ? "published" : "draft",
    })
    .select("id")
    .single();

  if (error || !event) {
    return { error: "Something went wrong creating your event. Please try again." };
  }

  redirect(`/events/${event.id}`);
}
