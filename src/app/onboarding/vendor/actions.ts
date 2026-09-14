"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2, "Business name is too short").max(150),
  primaryCategory: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
});

export interface VendorOnboardingState {
  error?: string;
}

// The vendor self-registration → Owner path — the single most consequential
// thing the Salesforce build never resolved (it was genuinely unknown
// whether a Customer Community User could create an Account at all). Here
// it's two inserts under RLS as the real signed-in user, not the service
// role: vendors_insert_authenticated requires created_by = auth.uid(), and
// vendor_team_members_insert_self_on_vendor_creation requires the caller be
// that same vendor's creator inserting themselves as Owner. Already proven
// at the API level in the Phase 0 verification; this is the real UI path.
export async function registerVendorBusiness(
  _prevState: VendorOnboardingState,
  formData: FormData,
): Promise<VendorOnboardingState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    primaryCategory: formData.get("primaryCategory"),
    description: formData.get("description"),
    phone: formData.get("phone"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { name, primaryCategory, description, phone, website } = parsed.data;

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .insert({
      name,
      primary_category: primaryCategory || null,
      description: description || null,
      phone: phone || null,
      website: website || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (vendorError || !vendor) {
    return { error: "Something went wrong creating your business. Please try again." };
  }

  const { error: memberError } = await supabase.from("vendor_team_members").insert({
    vendor_id: vendor.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    return { error: "Your business was created, but we couldn't set you up as its owner. Please contact support." };
  }

  // This insert doesn't mutate a cookie, so it doesn't get Next's automatic
  // "cookie mutation re-renders the current page" treatment — without this,
  // the root layout's session/persona data (read from vendor_team_members)
  // can still be served stale from the client Router Cache on redirect,
  // showing the Planner tab set instead of the new Vendor one. Found by
  // testing the actual redirect target, not assumed from the docs alone.
  revalidatePath("/", "layout");
  redirect(`/vendor/${vendor.id}/dashboard`);
}
