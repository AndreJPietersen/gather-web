"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

function refresh() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/admin/watchlist");
  revalidatePath("/admin/vendors/requests");
}

// The sign-up kill switch. Off stops every new account — the register page
// explains, and the auth.users trigger (migration 0044) refuses signups that
// skip the page. Existing users are unaffected.
export async function setRegistrationEnabled(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const enabled = formData.get("enabled") === "true";
  const service = createServiceClient();
  const { error } = await service
    .from("app_settings")
    .upsert({ id: true, registration_enabled: enabled, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return;

  await logAdminAction({
    adminId: userId,
    action: enabled ? "registration.enabled" : "registration.disabled",
    targetTable: "app_settings",
  });
  refresh();
  revalidatePath("/register");
}

export interface SettingsFormState {
  error?: string;
  saved?: boolean;
}

const whole = (min: number, max: number) => z.coerce.number().int("Whole numbers only.").min(min).max(max);

const limitsSchema = z.object({
  max_owned_businesses: whole(1, 100),
  listing_daily_limit: whole(1, 1000),
  max_email_recipients: whole(1, 100000),
});

// Owner limit + daily listing cap. Both are read by the database itself
// (the daily cap by a trigger on vendors), so a change applies at once.
export async function saveLimits(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const { userId } = await requireAdmin();
  const parsed = limitsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the numbers." };
  const service = createServiceClient();
  const { error } = await service
    .from("app_settings")
    .upsert({ id: true, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return { error: "Couldn't save those limits." };
  await logAdminAction({ adminId: userId, action: "limits.updated", targetTable: "app_settings", detail: parsed.data });
  refresh();
  return { saved: true };
}

const thresholdsSchema = z.object({
  watch_listing_min: whole(1, 1000),
  watch_listing_days: whole(1, 365),
  watch_contact_min: whole(2, 1000),
  watch_team_min: whole(1, 1000),
  watch_claim_min: whole(1, 1000),
  watch_claim_days: whole(1, 365),
  watch_invite_min: whole(1, 1000),
  watch_invite_days: whole(1, 365),
});

export async function saveWatchlistThresholds(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const { userId } = await requireAdmin();
  const parsed = thresholdsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the numbers." };
  const service = createServiceClient();
  const { error } = await service
    .from("app_settings")
    .upsert({ id: true, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return { error: "Couldn't save the thresholds." };
  await logAdminAction({ adminId: userId, action: "watchlist_thresholds.updated", targetTable: "app_settings", detail: parsed.data });
  refresh();
  return { saved: true };
}

// Per-table hourly write limits (write_rate_limits, enforced by the
// enforce_write_rate_limit trigger). Fields are named limit__<table_name>;
// only existing rows are updated, so this can't add limits to other tables.
export async function saveWriteRateLimits(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const { userId } = await requireAdmin();
  const updates: { table_name: string; max_per_hour: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("limit__")) continue;
    const parsed = whole(1, 100000).safeParse(value);
    if (!parsed.success) return { error: `"${key.slice(7)}" needs a whole number of at least 1.` };
    updates.push({ table_name: key.slice(7), max_per_hour: parsed.data });
  }
  const service = createServiceClient();
  for (const u of updates) {
    const { error } = await service
      .from("write_rate_limits")
      .update({ max_per_hour: u.max_per_hour, updated_at: new Date().toISOString() })
      .eq("table_name", u.table_name);
    if (error) return { error: `Couldn't save the limit for ${u.table_name}.` };
  }
  await logAdminAction({ adminId: userId, action: "write_rate_limits.updated", targetTable: "write_rate_limits", detail: { updates } });
  refresh();
  return { saved: true };
}
