"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sastInputToIso } from "@/lib/utils";
import type { EventFormState } from "../../event-form";

const schema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2, "Name is too short").max(150),
  eventType: z.string().trim().max(60).optional().or(z.literal("")),
  startAt: z.string().min(1, "Start date/time is required"),
  endAt: z.string().optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  visibility: z.enum(["public", "private", "invite_only"]),
  capacity: z.coerce.number().int().min(1).max(100000).optional(),
  publish: z.literal("true").optional(),
});

export async function updateEvent(_prevState: EventFormState, formData: FormData): Promise<EventFormState> {
  const parsed = schema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    eventType: formData.get("eventType"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    location: formData.get("location"),
    description: formData.get("description"),
    visibility: formData.get("visibility"),
    capacity: formData.get("capacity") || undefined,
    publish: formData.get("publish") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { eventId, name, eventType, startAt, endAt, location, description, visibility, capacity, publish } = parsed.data;

  const supabase = await createClient();

  // .single() errors on zero rows — which is exactly what happens if RLS
  // (events_update_owner_or_editor) silently filtered out an unauthorized
  // update, so this doubles as the authorization check.
  const { data: event, error } = await supabase
    .from("events")
    .update({
      name,
      event_type: eventType || null,
      start_at: sastInputToIso(startAt),
      end_at: endAt ? sastInputToIso(endAt) : null,
      location: location || null,
      description: description || null,
      visibility,
      capacity: capacity ?? null,
      status: publish ? "published" : "draft",
    })
    .eq("id", eventId)
    .select("id")
    .single();

  if (error || !event) {
    return { error: "Something went wrong saving your event. Please try again." };
  }

  redirect(`/events/${event.id}`);
}
