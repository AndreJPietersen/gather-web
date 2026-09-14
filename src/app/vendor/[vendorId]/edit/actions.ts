"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  vendorId: z.string().uuid(),
  name: z.string().trim().min(2, "Business name is too short").max(150),
  primaryCategory: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
});

export interface EditVendorState {
  error?: string;
}

// Same shape as onboarding/vendor's registerVendorBusiness — that action
// only ever creates a vendor, with nothing to edit these fields afterward.
// RLS (vendors_update_creator_stub_or_owner_manager) is the real
// enforcement, not the page-level access check on the edit page itself.
export async function updateVendorBusiness(_prevState: EditVendorState, formData: FormData): Promise<EditVendorState> {
  const parsed = schema.safeParse({
    vendorId: formData.get("vendorId"),
    name: formData.get("name"),
    primaryCategory: formData.get("primaryCategory"),
    description: formData.get("description"),
    phone: formData.get("phone"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { vendorId, name, primaryCategory, description, phone, website } = parsed.data;

  const supabase = await createClient();

  // .select("id").single() errors on zero rows — which is exactly what
  // happens if RLS silently filtered out an unauthorized update, so this
  // doubles as the authorization check, same idiom as updateEvent.
  const { data: vendor, error } = await supabase
    .from("vendors")
    .update({
      name,
      primary_category: primaryCategory || null,
      description: description || null,
      phone: phone || null,
      website: website || null,
    })
    .eq("id", vendorId)
    .select("id")
    .single();

  if (error || !vendor) {
    return { error: "Something went wrong saving your business details. Please try again." };
  }

  redirect(`/vendor/${vendor.id}/dashboard`);
}
