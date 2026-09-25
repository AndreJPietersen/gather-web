"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { callerFromCookies } from "@/server/context";
import { requestFeaturedPlacement as requestPlacement, withdrawFeaturedRequest as withdraw } from "@/server/services/featured";

// Thin Server Action wrappers: the rules (owner-only, one open request, the
// price at the time of asking) live in src/server/services/featured.ts,
// shared with the native apps' API.

export interface FeatureRequestState {
  error?: string;
}

function refresh(vendorId: string) {
  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/featured`);
  revalidatePath("/admin/featured");
  revalidatePath("/vendors");
}

export async function requestFeaturedPlacement(_prev: FeatureRequestState, formData: FormData): Promise<FeatureRequestState> {
  const caller = await callerFromCookies();
  if (!caller) return { error: "Your session expired — please log in again." };

  const result = await requestPlacement(caller, {
    vendorId: formData.get("vendorId"),
    spot: formData.get("spot"),
    duration: formData.get("duration"),
    startsOn: formData.get("startsOn"),
    vendorNote: formData.get("vendorNote") ?? "",
  });
  if (!result.ok) return { error: result.message };

  refresh(result.data.vendorId);
  redirect(`/vendor/${result.data.vendorId}/featured?sent=1`);
}

export async function withdrawFeaturedRequest(formData: FormData): Promise<void> {
  const caller = await callerFromCookies();
  if (!caller) return;
  const result = await withdraw(caller, { vendorId: formData.get("vendorId"), placementId: formData.get("placementId") });
  if (result.ok) refresh(result.data.vendorId);
}
