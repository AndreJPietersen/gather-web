import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/admin/audit-log";

// Admin moderation building blocks. Every function here uses the service
// role, so callers must already have passed requireAdmin() — they live in
// src/lib only so the user, vendor and watchlist admin pages share one
// implementation (src/app/admin/moderation/actions.ts wraps them).

// ~100 years: Supabase Auth has no "ban forever", only a duration.
const PERMANENT_BAN = "876000h";

export interface ModerationResult {
  error?: string;
  hiddenCount?: number;
}

// Hides listings from every public read (vendors.hidden_at — see the
// vendors_select_public_or_own policy). Already-hidden ones are left alone.
export async function hideVendors(vendorIds: string[], adminId: string, reason: string | null): Promise<number> {
  if (vendorIds.length === 0) return 0;
  const service = createServiceClient();
  const { data } = await service
    .from("vendors")
    .update({ hidden_at: new Date().toISOString() })
    .in("id", vendorIds)
    .is("hidden_at", null)
    .select("id");
  for (const row of data ?? []) {
    await logAdminAction({ adminId, action: "vendor.hidden", targetTable: "vendors", targetId: row.id, detail: { reason } });
  }
  return data?.length ?? 0;
}

export async function restoreVendor(vendorId: string, adminId: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("vendors").update({ hidden_at: null }).eq("id", vendorId);
  if (!error) await logAdminAction({ adminId, action: "vendor.restored", targetTable: "vendors", targetId: vendorId });
}

// The listings a user is responsible for: stubs they created that nobody has
// claimed, and businesses where they are the *only* active Owner. A business
// they co-own with someone else is left visible — hiding it would punish the
// other owner.
export async function listingsControlledBy(userId: string): Promise<string[]> {
  const service = createServiceClient();
  const [{ data: stubs }, { data: owned }] = await Promise.all([
    service.from("vendors").select("id").eq("created_by", userId).eq("verification_status", "unclaimed"),
    service.from("vendor_team_members").select("vendor_id").eq("user_id", userId).eq("role", "owner").eq("is_active", true),
  ]);
  const ownedIds = (owned ?? []).map((o) => o.vendor_id);
  let soleOwned: string[] = [];
  if (ownedIds.length > 0) {
    const { data: coOwners } = await service
      .from("vendor_team_members")
      .select("vendor_id")
      .in("vendor_id", ownedIds)
      .eq("role", "owner")
      .eq("is_active", true)
      .neq("user_id", userId);
    const shared = new Set((coOwners ?? []).map((c) => c.vendor_id));
    soleOwned = ownedIds.filter((id) => !shared.has(id));
  }
  return Array.from(new Set([...(stubs ?? []).map((s) => s.id), ...soleOwned]));
}

export async function suspendUser(
  userId: string,
  adminId: string,
  reason: string | null,
  hideTheirListings: boolean,
): Promise<ModerationResult> {
  if (userId === adminId) return { error: "You can't suspend yourself." };
  const service = createServiceClient();
  // is_admin() only answers for the *calling* user, so read the target's
  // flag directly (service role).
  const { data: target } = await service.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!target) return { error: "That user doesn't exist." };
  if (target.is_admin) return { error: "Admins can't be suspended from the console — remove their admin flag first." };

  // The real lock-out: a Supabase Auth ban stops sign-in and token refresh.
  const { error: banError } = await service.auth.admin.updateUserById(userId, { ban_duration: PERMANENT_BAN });
  if (banError) return { error: `Couldn't suspend the account: ${banError.message}` };

  await service.from("user_suspensions").upsert({ user_id: userId, reason, suspended_by: adminId }, { onConflict: "user_id" });

  // Anything they were waiting on would otherwise sit in the admin queues.
  const reviewed = { status: "rejected" as const, reviewed_by: adminId, reviewed_at: new Date().toISOString(), rejection_reason: "Account suspended." };
  await Promise.all([
    service.from("vendor_claim_requests").update(reviewed).eq("created_by", userId).eq("status", "pending"),
    service.from("vendor_business_requests").update(reviewed).eq("requester_id", userId).eq("status", "pending"),
  ]);

  const hiddenCount = hideTheirListings ? await hideVendors(await listingsControlledBy(userId), adminId, "Owner suspended") : 0;

  await logAdminAction({
    adminId,
    action: "user.suspended",
    targetTable: "profiles",
    targetId: userId,
    detail: { reason, hiddenListings: hiddenCount },
  });
  return { hiddenCount };
}

export async function unsuspendUser(userId: string, adminId: string): Promise<ModerationResult> {
  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) return { error: `Couldn't lift the suspension: ${error.message}` };
  await service.from("user_suspensions").delete().eq("user_id", userId);
  await logAdminAction({ adminId, action: "user.unsuspended", targetTable: "profiles", targetId: userId });
  return {};
}

// Takes someone off a vendor team (the same soft-delete the team page uses).
export async function removeTeamMember(memberId: string, adminId: string): Promise<void> {
  const service = createServiceClient();
  const { data } = await service
    .from("vendor_team_members")
    .update({ is_active: false })
    .eq("id", memberId)
    .select("vendor_id, user_id, role")
    .maybeSingle();
  if (data) {
    await logAdminAction({
      adminId,
      action: "vendor_team_member.removed",
      targetTable: "vendor_team_members",
      targetId: memberId,
      detail: data,
    });
  }
}
