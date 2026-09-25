"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";
import {
  hideVendors,
  listingsControlledBy,
  removeTeamMember,
  restoreVendor,
  suspendUser,
  unsuspendUser,
} from "@/lib/admin/moderation";

// Moderation actions shared by the user page, the vendor page and the
// watchlist. Every one re-checks requireAdmin() itself — a Server Action is
// a public endpoint no matter which page renders its form.

const uuid = z.string().uuid();
const reason = z.string().trim().max(500).optional().or(z.literal(""));

function refreshModerationSurfaces(extra: string[] = []) {
  for (const path of ["/admin", "/admin/watchlist", "/admin/vendors", "/admin/planners", "/vendors", "/", ...extra]) {
    revalidatePath(path);
  }
}

export interface SuspendState {
  error?: string;
  message?: string;
}

export async function suspendUserAction(_prev: SuspendState, formData: FormData): Promise<SuspendState> {
  const { userId: adminId } = await requireAdmin();
  const parsed = z
    .object({ userId: uuid, reason, hideListings: z.string().optional() })
    .safeParse({
      userId: formData.get("userId"),
      reason: formData.get("reason") ?? "",
      hideListings: formData.get("hideListings") ?? undefined,
    });
  if (!parsed.success) return { error: "Something was wrong with that request." };

  const result = await suspendUser(parsed.data.userId, adminId, parsed.data.reason || null, parsed.data.hideListings === "on");
  if (result.error) return { error: result.error };
  refreshModerationSurfaces([`/admin/planners/${parsed.data.userId}`]);
  return {
    message: `Suspended.${result.hiddenCount ? ` ${result.hiddenCount} listing${result.hiddenCount === 1 ? "" : "s"} hidden.` : ""}`,
  };
}

export async function unsuspendUserAction(formData: FormData): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  const parsed = uuid.safeParse(formData.get("userId"));
  if (!parsed.success) return;
  await unsuspendUser(parsed.data, adminId);
  refreshModerationSurfaces([`/admin/planners/${parsed.data}`]);
}

export async function hideUserListingsAction(formData: FormData): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  const parsed = uuid.safeParse(formData.get("userId"));
  if (!parsed.success) return;
  await hideVendors(await listingsControlledBy(parsed.data), adminId, "Hidden from the user's admin page");
  refreshModerationSurfaces([`/admin/planners/${parsed.data}`]);
}

// Hide one listing (vendor page) or several at once (a watchlist entry's
// "Hide these listings") — vendorIds is a comma-separated list.
export async function hideVendorsAction(formData: FormData): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  const ids = String(formData.get("vendorIds") ?? "")
    .split(",")
    .filter((id) => uuid.safeParse(id).success);
  const parsedReason = reason.safeParse(formData.get("reason") ?? "");
  await hideVendors(ids, adminId, parsedReason.success && parsedReason.data ? parsedReason.data : null);
  refreshModerationSurfaces(ids.map((id) => `/admin/vendors/${id}`));
}

export async function restoreVendorAction(formData: FormData): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  const parsed = uuid.safeParse(formData.get("vendorId"));
  if (!parsed.success) return;
  await restoreVendor(parsed.data, adminId);
  refreshModerationSurfaces([`/admin/vendors/${parsed.data}`]);
}

export async function removeTeamMemberAction(formData: FormData): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  const parsed = uuid.safeParse(formData.get("memberId"));
  if (!parsed.success) return;
  await removeTeamMember(parsed.data, adminId);
  refreshModerationSurfaces();
}

// "Looked at this, it's fine" — hidden until the entry's count grows past
// what it was now.
export async function dismissWatchlistEntryAction(formData: FormData): Promise<void> {
  const { userId: adminId } = await requireAdmin();
  const parsed = z
    .object({ signal: z.string().min(1).max(40), subjectKey: z.string().min(1).max(300), hits: z.coerce.number().int().min(0), note: reason })
    .safeParse({
      signal: formData.get("signal"),
      subjectKey: formData.get("subjectKey"),
      hits: formData.get("hits"),
      note: formData.get("note") ?? "",
    });
  if (!parsed.success) return;
  const service = createServiceClient();
  await service.from("admin_watchlist_dismissals").upsert(
    {
      signal: parsed.data.signal,
      subject_key: parsed.data.subjectKey,
      hits_at_dismissal: parsed.data.hits,
      note: parsed.data.note || null,
      dismissed_by: adminId,
      created_at: new Date().toISOString(),
    },
    { onConflict: "signal,subject_key" },
  );
  await logAdminAction({
    adminId,
    action: "watchlist.dismissed",
    targetTable: "admin_watchlist_dismissals",
    detail: { signal: parsed.data.signal, subjectKey: parsed.data.subjectKey, hits: parsed.data.hits },
  });
  revalidatePath("/admin/watchlist");
  revalidatePath("/admin");
}

export async function undoDismissalAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = uuid.safeParse(formData.get("dismissalId"));
  if (!parsed.success) return;
  const service = createServiceClient();
  await service.from("admin_watchlist_dismissals").delete().eq("id", parsed.data);
  revalidatePath("/admin/watchlist");
  revalidatePath("/admin");
}
