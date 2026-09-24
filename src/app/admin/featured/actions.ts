"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { createServiceClient } from "@/lib/supabase/service";

export interface PlacementFormState {
  error?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const placementSchema = z
  .object({
    placementId: z.string().uuid().optional().or(z.literal("")),
    vendorId: z.string().uuid("Choose a vendor."),
    startsOn: z.string().regex(DATE, "Choose a start date."),
    endsOn: z.string().regex(DATE, "Choose an end date."),
    position: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .pipe(z.number().int("Position must be a whole number.").min(1, "Position starts at 1.").max(50).nullable()),
    status: z.enum(["pending", "activated"]),
    feeAmount: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .pipe(z.number().min(0, "The fee cannot be negative.").nullable()),
    note: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
  })
  .refine((v) => v.endsOn >= v.startsOn, { message: "The end date cannot be before the start date.", path: ["endsOn"] });

// One action for both create and edit (a hidden placementId distinguishes
// them). On success it redirects back to the list — the same "+Add then land
// on the list" convention the rest of the app's add forms follow.
export async function savePlacement(_prev: PlacementFormState, formData: FormData): Promise<PlacementFormState> {
  const { userId } = await requireAdmin();
  const parsed = placementSchema.safeParse({
    placementId: formData.get("placementId") ?? "",
    vendorId: formData.get("vendorId"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    position: formData.get("position") ?? "",
    status: formData.get("status"),
    feeAmount: formData.get("feeAmount") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const v = parsed.data;
  const service = createServiceClient();

  // Two placements cannot hold the same pinned position over overlapping
  // dates — otherwise "rank 1" would be a tie decided by nothing visible.
  // Cancelled ones do not count, and neither does the row being edited.
  if (v.position !== null) {
    let clash = service
      .from("vendor_feature_placements")
      .select("id, vendors(name)")
      .eq("position", v.position)
      .in("status", ["pending", "activated"])
      .lte("starts_on", v.endsOn)
      .gte("ends_on", v.startsOn);
    if (v.placementId) clash = clash.neq("id", v.placementId);
    const { data: clashes } = await clash.limit(1).returns<{ id: string; vendors: { name: string } | null }[]>();
    if (clashes && clashes.length > 0) {
      return {
        error: `Position #${v.position} is already held by ${clashes[0].vendors?.name ?? "another vendor"} for overlapping dates.`,
      };
    }
  }

  const values = {
    vendor_id: v.vendorId,
    status: v.status,
    starts_on: v.startsOn,
    ends_on: v.endsOn,
    position: v.position,
    fee_amount: v.feeAmount,
    note: v.note ? v.note : null,
    updated_at: new Date().toISOString(),
  };

  let placementId = v.placementId || null;
  if (placementId) {
    const { error } = await service.from("vendor_feature_placements").update(values).eq("id", placementId);
    if (error) return { error: "Something went wrong saving that placement." };
  } else {
    const { data, error } = await service
      .from("vendor_feature_placements")
      .insert({ ...values, created_by: userId })
      .select("id")
      .single();
    if (error || !data) return { error: "Something went wrong creating that placement." };
    placementId = data.id;
  }

  await logAdminAction({
    adminId: userId,
    action: v.placementId ? "feature_placement.updated" : "feature_placement.created",
    targetTable: "vendor_feature_placements",
    targetId: placementId,
    detail: { vendorId: v.vendorId, status: v.status, startsOn: v.startsOn, endsOn: v.endsOn, position: v.position },
  });

  revalidatePlacementSurfaces();
  redirect("/admin/featured");
}

const statusSchema = z.object({
  placementId: z.string().uuid(),
  status: z.enum(["pending", "activated", "cancelled"]),
});

// Activate (mark paid/confirmed), cancel, or send back to pending — a plain
// fire-and-forget flip like the other single-button admin actions.
export async function setPlacementStatus(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const parsed = statusSchema.safeParse({ placementId: formData.get("placementId"), status: formData.get("status") });
  if (!parsed.success) return;

  const service = createServiceClient();
  const { error } = await service
    .from("vendor_feature_placements")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.placementId);
  if (error) return;

  await logAdminAction({
    adminId: userId,
    action: `feature_placement.${parsed.data.status}`,
    targetTable: "vendor_feature_placements",
    targetId: parsed.data.placementId,
  });
  revalidatePlacementSurfaces();
}

// Featured status shows on the home page, the marketplace, and vendor pages,
// and (for the admin) on the vendor list/detail — refresh all of them.
function revalidatePlacementSurfaces() {
  revalidatePath("/admin/featured");
  revalidatePath("/admin/vendors");
  revalidatePath("/vendors");
  revalidatePath("/");
}
