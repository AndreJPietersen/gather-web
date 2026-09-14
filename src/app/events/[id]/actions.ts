"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, findUserByEmail } from "@/lib/supabase/service";

const rsvpSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("That doesn't look like a valid email").max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(0).max(20),
});

export interface RsvpState {
  error?: string;
  success?: boolean;
}

// Guest RSVP: a narrow, explicitly-validated DTO written via the service
// role, never a client-side anon INSERT policy on the raw table — see
// docs/gather_web_architecture.md's Authorization Model Port for why. The
// event id is re-checked against the request-scoped (RLS-respecting) client
// before writing, so a crafted request can't RSVP onto a private/draft
// event just by guessing its id.
export async function submitRsvp(_prevState: RsvpState, formData: FormData): Promise<RsvpState> {
  const parsed = rsvpSchema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    guestCount: formData.get("guestCount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details and try again." };
  }

  const { eventId, name, email, phone, guestCount } = parsed.data;

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("status", "published")
    .eq("visibility", "public")
    .maybeSingle();

  if (!event) {
    return { error: "This event isn't accepting RSVPs." };
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.from("event_attendees").insert({
    event_id: eventId,
    name,
    email,
    phone: phone || null,
    guest_count: guestCount,
    rsvp_status: "attending",
  });

  if (error) {
    return { error: "Something went wrong submitting your RSVP. Please try again." };
  }

  return { success: true };
}

const inviteSchema = z.object({
  eventId: z.string().uuid(),
  email: z.string().trim().email("That doesn't look like a valid email").max(200),
  permissionLevel: z.enum(["editor", "viewer"]),
});

export interface InviteCollaboratorState {
  error?: string;
  success?: boolean;
}

// event_collaborators has no email-invite bridge table like vendor_team_invites
// does for vendors — the invitee must already have a Gather account, looked
// up via findUserByEmail (never through a publicly-selectable email column;
// see that function's own comment). The actual insert still goes through the
// request-scoped client, so event_collaborators_insert_owner_or_editor still
// enforces that only the owner or an accepted Editor collaborator can invite.
export async function inviteCollaborator(
  _prevState: InviteCollaboratorState,
  formData: FormData,
): Promise<InviteCollaboratorState> {
  const parsed = inviteSchema.safeParse({
    eventId: formData.get("eventId"),
    email: formData.get("email"),
    permissionLevel: formData.get("permissionLevel"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { eventId, email, permissionLevel } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const invitee = await findUserByEmail(email);
  if (!invitee) {
    return { error: "No Gather account found for that email." };
  }

  if (invitee.id === user.id) {
    return { error: "That's your own account." };
  }

  const { error } = await supabase.from("event_collaborators").insert({
    event_id: eventId,
    user_id: invitee.id,
    permission_level: permissionLevel,
    invited_by: user.id,
  });

  if (error) {
    return { error: "Something went wrong sending the invite — they may already be invited." };
  }

  // Deliberately not calling revalidatePath here: Phase 4 found that any
  // server-triggered re-render bundled into a Server Action's own response
  // (cookie mutation, revalidatePath, redirect) can reseed the client tree
  // before useActionState's returned value is read — fine for a redirect
  // (nothing downstream depends on the old state), but here it would risk
  // silently losing this exact {success: true}. Simplest robust choice: the
  // form just confirms success on its own; the owner sees the new row in
  // the collaborators list on their next normal navigation/reload.
  return { success: true };
}
