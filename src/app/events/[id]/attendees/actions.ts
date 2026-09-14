"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("That doesn't look like a valid email").max(200).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(0).max(20),
});

export interface AttendeeFormState {
  error?: string;
}

// The authenticated owner/editor-collaborator quick-add path — distinct
// from Phase 3's anonymous guest RSVP (which goes through the service role
// after re-checking the event is public). This one is a plain insert under
// RLS as the real signed-in user; event_attendees_insert_owner_or_editor
// gates it.
export async function addAttendee(_prevState: AttendeeFormState, formData: FormData): Promise<AttendeeFormState> {
  const parsed = schema.safeParse({
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

  // Unlike inviteCollaborator, there's no returned-state value worth
  // preserving here (just {} on success) — revalidating is pure upside: it
  // refreshes the visible list AND clears the form's uncontrolled inputs by
  // remounting it, the "quick add" UX the Salesforce build's own
  // refreshApex-after-each-mutation pattern was going for.
  revalidatePath(`/events/${eventId}/attendees`);
  return {};
}
