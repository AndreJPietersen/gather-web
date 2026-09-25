import { z } from "zod";
import { createServiceClient, findUserByEmail } from "@/lib/supabase/service";
import { friendlyWriteError } from "@gather/shared/db-errors";
import type { Caller } from "@/server/context";
import { fail, invalid, ok, type ServiceResult } from "@/server/result";

const rsvpSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("That doesn't look like a valid email").max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(0).max(20),
});

// Guest RSVP (no account needed): a narrow, explicitly-validated write via
// the service role, never an anon INSERT policy on the raw table. The event
// is checked to be published and public first, so a crafted request can't
// RSVP onto a private or draft event just by guessing its id.
export async function submitGuestRsvp(input: unknown): Promise<ServiceResult> {
  const parsed = rsvpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message, "Please check your details and try again.");
  const { eventId, name, email, phone, guestCount } = parsed.data;

  const service = createServiceClient();
  const { data: event } = await service
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("status", "published")
    .eq("visibility", "public")
    .maybeSingle();
  if (!event) return fail(404, "not_accepting_rsvps", "This event isn't accepting RSVPs.");

  const { error } = await service.from("event_attendees").insert({
    event_id: eventId,
    name,
    email,
    phone: phone || null,
    guest_count: guestCount,
    rsvp_status: "attending",
  });
  if (error) return fail(500, "rsvp_failed", "Something went wrong submitting your RSVP. Please try again.");
  return ok();
}

const inviteSchema = z.object({
  eventId: z.string().uuid(),
  email: z.string().trim().email("That doesn't look like a valid email").max(200),
  permissionLevel: z.enum(["editor", "viewer"]),
});

// The invitee must already have a Gather account, looked up via
// findUserByEmail (never through a publicly-selectable email column). The
// insert itself goes through the caller's own client, so
// event_collaborators_insert_owner_or_editor still enforces that only the
// owner or an accepted Editor collaborator can invite.
export async function inviteCollaborator(caller: Caller, input: unknown): Promise<ServiceResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message);
  const { eventId, email, permissionLevel } = parsed.data;

  const invitee = await findUserByEmail(email);
  if (!invitee) return fail(404, "no_such_account", "No Gather account found for that email.");
  if (invitee.id === caller.userId) return fail(400, "self_invite", "That's your own account.");

  const { error } = await caller.supabase.from("event_collaborators").insert({
    event_id: eventId,
    user_id: invitee.id,
    permission_level: permissionLevel,
    invited_by: caller.userId,
  });
  if (error) {
    return fail(409, "invite_failed", friendlyWriteError(error, "Something went wrong sending the invite — they may already be invited."));
  }
  return ok();
}
