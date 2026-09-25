"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";
import { FEATURE_DURATIONS, FEATURE_SPOTS } from "@gather/shared/feature-pricing";

export interface PricingFormState {
  error?: string;
  saved?: boolean;
}

// Saves the whole 2 × 3 price grid in one go. Each field is named
// "<spot>__<duration>"; a blank field clears that price back to
// "Price on request".
export async function saveFeaturePrices(_prev: PricingFormState, formData: FormData): Promise<PricingFormState> {
  const { userId } = await requireAdmin();

  const updates: { spot: string; duration: string; amount: number | null }[] = [];
  for (const spot of FEATURE_SPOTS) {
    for (const duration of FEATURE_DURATIONS) {
      const raw = String(formData.get(`${spot.id}__${duration.id}`) ?? "").trim();
      if (raw === "") {
        updates.push({ spot: spot.id, duration: duration.id, amount: null });
        continue;
      }
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        return { error: `${spot.label}, ${duration.label}: enter a price of 0 or more, or leave it blank.` };
      }
      updates.push({ spot: spot.id, duration: duration.id, amount });
    }
  }

  const service = createServiceClient();
  const now = new Date().toISOString();
  for (const u of updates) {
    const { error } = await service
      .from("feature_prices")
      .upsert({ spot: u.spot, duration: u.duration, amount: u.amount, updated_at: now }, { onConflict: "spot,duration" });
    if (error) return { error: "Something went wrong saving the prices." };
  }

  await logAdminAction({ adminId: userId, action: "feature_prices.updated", targetTable: "feature_prices", detail: { prices: updates } });

  revalidatePath("/admin/featured/pricing");
  revalidatePath("/featured");
  return { saved: true };
}
