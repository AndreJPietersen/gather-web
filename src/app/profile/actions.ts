"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const inviteResponseSchema = z.object({
  collaboratorId: z.string().uuid(),
  decision: z.enum(["accepted", "declined"]),
});

// event_collaborators_update_self_or_event_owner lets the invited user
// update their own row (accept/decline) — no separate RPC needed, unlike
// the Salesforce build's dedicated accept/decline controller methods.
export async function respondToEventInvite(formData: FormData): Promise<void> {
  const parsed = inviteResponseSchema.safeParse({
    collaboratorId: formData.get("collaboratorId"),
    decision: formData.get("decision"),
  });

  if (!parsed.success) {
    return;
  }

  const supabase = await createClient();
  await supabase.from("event_collaborators").update({ status: parsed.data.decision }).eq("id", parsed.data.collaboratorId);

  revalidatePath("/profile");
}

// Upserted on demand rather than seeded by the signup trigger — no row
// exists until the first save, so the form renders with hardcoded defaults
// (matching the column defaults) when there's nothing in the DB yet.
const upcomingWindowSchema = z.enum(["on_day", "one_day_before", "one_week_before"]);

export interface SaveNotificationPreferencesState {
  success?: boolean;
}

// Returns state + is driven by useActionState/router.refresh() on the
// client (see notification-preferences-form.tsx), not a plain
// `action={serverFunction}` form — revalidatePath() alone reliably updates
// the server-side cache but doesn't reliably repaint the *already-mounted*
// client page with the new value; the select kept showing the pre-save
// option until a hard reload even though the DB write was correct on the
// very first save. Same root cause and same fix as AcceptQuoteForm's own
// documented staleness bug: a client-triggered router.refresh(), which
// runs after useActionState has already committed this action's response.
export async function saveNotificationPreferences(
  _prevState: SaveNotificationPreferencesState,
  formData: FormData,
): Promise<SaveNotificationPreferencesState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsedWindow = upcomingWindowSchema.safeParse(formData.get("upcomingWindow"));

  await supabase.from("notification_preferences").upsert({
    profile_id: user.id,
    email_reminders: formData.get("emailReminders") === "on",
    // SMS/push stay false regardless of any future form input — those
    // channels aren't actually implemented yet (see the table's own
    // migration comment), so there's nothing to opt into.
    sms_reminders: false,
    push_reminders: false,
    upcoming_window: parsedWindow.success ? parsedWindow.data : "one_week_before",
  });

  // Home and My Events both read this preference server-side on every
  // render, so they need to be told this changed too, not just Profile —
  // still needed for those OTHER pages' server-side caches even though
  // Profile's own repaint now goes through router.refresh() instead.
  revalidatePath("/");
  revalidatePath("/events");

  return { success: true };
}

const vendorInviteResponseSchema = z.object({
  inviteId: z.string().uuid(),
  vendorId: z.string().uuid(),
  role: z.enum(["owner", "manager", "staff"]),
  decision: z.enum(["accepted", "declined"]),
});

// Two sequential writes, same shape as Phase 7's accept-quote: the invite
// row has to actually be Accepted before vendor_team_members_insert_self_
// on_accepted_invite's policy will allow the second insert — that policy
// checks for a matching Accepted invite by design, so this can't be
// reordered into one step.
export async function respondToVendorInvite(formData: FormData): Promise<void> {
  const parsed = vendorInviteResponseSchema.safeParse({
    inviteId: formData.get("inviteId"),
    vendorId: formData.get("vendorId"),
    role: formData.get("role"),
    decision: formData.get("decision"),
  });

  if (!parsed.success) {
    return;
  }

  const { inviteId, vendorId, role, decision } = parsed.data;

  const supabase = await createClient();
  await supabase.from("vendor_team_invites").update({ status: decision }).eq("id", inviteId);

  if (decision === "accepted") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("vendor_team_members").insert({ vendor_id: vendorId, user_id: user.id, role });
    }
  }

  revalidatePath("/profile");
}
