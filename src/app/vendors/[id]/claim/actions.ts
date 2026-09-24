"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyWriteError } from "@/lib/db-errors";

const schema = z.object({
  vendorId: z.string().uuid(),
  notes: z.string().trim().min(10, "Add a few more details so we can verify you").max(1000),
});

export interface ClaimFormState {
  error?: string;
}

export async function submitClaim(_prevState: ClaimFormState, formData: FormData): Promise<ClaimFormState> {
  const parsed = schema.safeParse({
    vendorId: formData.get("vendorId"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { vendorId, notes } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Claiming an already-verified vendor doesn't make sense — an app-level
  // check, not a DB constraint, matching this project's existing pattern
  // for business rules that don't need to be a hard schema invariant.
  const { data: vendor } = await supabase
    .from("vendors")
    .select("verification_status")
    .eq("id", vendorId)
    .maybeSingle();

  if (!vendor) {
    return { error: "That vendor listing no longer exists." };
  }
  if (vendor.verification_status === "verified") {
    return { error: "This listing is already verified." };
  }

  const { error } = await supabase.from("vendor_claim_requests").insert({
    vendor_id: vendorId,
    notes,
    created_by: user.id,
  });

  if (error) {
    return { error: friendlyWriteError(error, "Something went wrong submitting your claim. Please try again.") };
  }

  redirect(`/vendors/${vendorId}`);
}
