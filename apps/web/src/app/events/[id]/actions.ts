"use server";

import { redirect } from "next/navigation";
import { callerFromCookies } from "@/server/context";
import { inviteCollaborator as invite, submitGuestRsvp } from "@/server/services/events";

// Thin Server Action wrappers: the rules live in src/server/services/events.ts,
// shared with the native apps' API.

export interface RsvpState {
  error?: string;
  success?: boolean;
}

export async function submitRsvp(_prevState: RsvpState, formData: FormData): Promise<RsvpState> {
  const result = await submitGuestRsvp({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    guestCount: formData.get("guestCount"),
  });
  return result.ok ? { success: true } : { error: result.message };
}

export interface InviteCollaboratorState {
  error?: string;
  success?: boolean;
}

// Deliberately not calling revalidatePath here: any server-triggered
// re-render bundled into a Server Action's own response can reseed the
// client tree before useActionState's returned value is read, silently
// losing this exact {success: true}. The owner sees the new row in the
// collaborators list on their next normal navigation/reload.
export async function inviteCollaborator(_prevState: InviteCollaboratorState, formData: FormData): Promise<InviteCollaboratorState> {
  const caller = await callerFromCookies();
  if (!caller) redirect("/login");

  const result = await invite(caller, {
    eventId: formData.get("eventId"),
    email: formData.get("email"),
    permissionLevel: formData.get("permissionLevel"),
  });
  return result.ok ? { success: true } : { error: result.message };
}
