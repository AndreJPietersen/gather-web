"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { attendeeSchema } from "./schema";

export interface AttendeeFormState {
  error?: string;
}

// The authenticated owner/editor-collaborator quick-add path — distinct
// from Phase 3's anonymous guest RSVP (which goes through the service role
// after re-checking the event is public). This one is a plain insert under
// RLS as the real signed-in user; event_attendees_insert_owner_or_editor
// gates it.
export async function addAttendee(_prevState: AttendeeFormState, formData: FormData): Promise<AttendeeFormState> {
  const parsed = attendeeSchema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    email: formData.get("email"),
    guestCount: formData.get("guestCount") || 0,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { eventId, name, email, guestCount } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("event_attendees").insert({
    event_id: eventId,
    name,
    email: email || null,
    guest_count: guestCount,
    rsvp_status: "no_response",
  });

  if (error) {
    return { error: "Something went wrong adding that attendee. Please try again." };
  }

  revalidatePath(`/events/${eventId}/attendees`);
  // Back to the attendee list on success, same "+ Add" pattern as the
  // Budget/Payments add screens (Andre's own ask).
  redirect(`/events/${eventId}/attendees`);
}

const updateDetailsSchema = z.object({
  attendeeId: z.string().uuid(),
  eventId: z.string().uuid(),
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("That doesn't look like a valid email").max(200).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(0).max(20),
});

export interface UpdateAttendeeDetailsState {
  error?: string;
  success?: boolean;
}

// There was previously no way back to an attendee's own details after
// adding them — only their RSVP status could be changed afterward. Same
// shape as addAttendee's schema (event_attendees_update_owner_or_editor is
// the same RLS policy updateAttendeeRsvp already relies on), and the same
// "check the returned rows, not just {error}" idiom for turning an
// RLS-filtered no-op into a real, detectable failure.
export async function updateAttendeeDetails(
  _prevState: UpdateAttendeeDetailsState,
  formData: FormData,
): Promise<UpdateAttendeeDetailsState> {
  const parsed = updateDetailsSchema.safeParse({
    attendeeId: formData.get("attendeeId"),
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    email: formData.get("email"),
    guestCount: formData.get("guestCount") || 0,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { attendeeId, eventId, name, email, guestCount } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_attendees")
    .update({ name, email: email || null, guest_count: guestCount })
    .eq("id", attendeeId)
    .eq("event_id", eventId)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "Couldn't save those changes. Please refresh and try again." };
  }

  revalidatePath(`/events/${eventId}/attendees`);
  return { success: true };
}

const updateRsvpSchema = z.object({
  attendeeId: z.string().uuid(),
  eventId: z.string().uuid(),
  rsvpStatus: z.enum(["attending", "declined", "maybe", "no_response"]),
});

export interface UpdateRsvpState {
  error?: string;
}

// Lets the owner/editor record an RSVP they heard about outside the app
// (a text, a call) — event_attendees_update_owner_or_editor already permits
// this at the RLS level, so this is purely wiring a UI to an update that was
// already allowed. Returns a real result (not void) so the caller can revert
// its optimistic UI on failure — found in code review: a silently-discarded
// {error} plus an uncontrolled <select> meant a failed write looked
// identical to a successful one, since the browser had already applied the
// picked value regardless of what actually happened server-side. Also
// checks the returned rows, not just {error}: an RLS-filtered update (wrong
// id, a row that no longer matches) fails silently with zero rows affected
// and no error at all, which `.select("id")` here turns into a detectable
// empty array instead.
export async function updateAttendeeRsvp(formData: FormData): Promise<UpdateRsvpState> {
  const parsed = updateRsvpSchema.safeParse({
    attendeeId: formData.get("attendeeId"),
    eventId: formData.get("eventId"),
    rsvpStatus: formData.get("rsvpStatus"),
  });
  if (!parsed.success) {
    return { error: "Something went wrong. Please try again." };
  }

  const { attendeeId, eventId, rsvpStatus } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_attendees")
    .update({ rsvp_status: rsvpStatus })
    .eq("id", attendeeId)
    .eq("event_id", eventId)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "Couldn't update that RSVP. Please refresh and try again." };
  }

  revalidatePath(`/events/${eventId}/attendees`);
  return {};
}
