"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyWriteError } from "@gather/shared/db-errors";

const inviteSchema = z.object({
  vendorId: z.string().uuid(),
  email: z.string().trim().email("That doesn't look like a valid email").max(200),
  role: z.enum(["manager", "staff"]),
});

export interface InviteTeamMemberState {
  error?: string;
  success?: boolean;
}

// Unlike event_collaborators' invite (which resolves an existing user via
// findUserByEmail at invite time), vendor_team_invites is deliberately
// email-only — per the ERD, this is what lets someone be invited before
// they have a Gather account at all. No lookup needed here; they accept
// later, once signed in, from their own Profile page.
export async function inviteTeamMember(
  _prevState: InviteTeamMemberState,
  formData: FormData,
): Promise<InviteTeamMemberState> {
  const parsed = inviteSchema.safeParse({
    vendorId: formData.get("vendorId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { vendorId, email, role } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase.from("vendor_team_invites").insert({
    vendor_id: vendorId,
    invited_email: email,
    role,
    invited_by: user.id,
  });

  if (error) {
    return { error: friendlyWriteError(error, "Something went wrong sending that invite. Please try again.") };
  }

  return { success: true };
}

export async function updateMemberRole(formData: FormData): Promise<void> {
  const memberId = formData.get("memberId");
  const vendorId = formData.get("vendorId");
  const role = formData.get("role");
  if (typeof memberId !== "string" || typeof vendorId !== "string" || typeof role !== "string") return;

  const supabase = await createClient();
  await supabase.from("vendor_team_members").update({ role }).eq("id", memberId);

  revalidatePath(`/vendor/${vendorId}/team`);
}

export async function revokeMember(formData: FormData): Promise<void> {
  const memberId = formData.get("memberId");
  const vendorId = formData.get("vendorId");
  if (typeof memberId !== "string" || typeof vendorId !== "string") return;

  const supabase = await createClient();
  // Soft revoke (is_active = false), not a delete — preserves history, and
  // matches exactly what that column exists for.
  await supabase.from("vendor_team_members").update({ is_active: false }).eq("id", memberId);

  revalidatePath(`/vendor/${vendorId}/team`);
}
