"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(150),
  primaryCategory: z.string().trim().max(100).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
});

export interface CreateStubState {
  error?: string;
}

// Community-sourced vendor bootstrapping (see docs/gather_web_architecture.md's
// Vendor Directory Bootstrapping & Verification section): just a name,
// category, and basic contact info — everything richer waits for the real
// vendor to claim it. Dedupe-before-create is enforced by this page's own
// flow (the create form only ever renders after a search), not here.
export async function createStubVendor(_prevState: CreateStubState, formData: FormData): Promise<CreateStubState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    primaryCategory: formData.get("primaryCategory"),
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

  const { name, primaryCategory, phone, website } = parsed.data;

  const { data: vendor, error } = await supabase
    .from("vendors")
    .insert({
      name,
      primary_category: primaryCategory || null,
      phone: phone || null,
      website: website || null,
      created_by: user.id,
      // verification_status defaults to 'unclaimed' — no need to set it.
    })
    .select("id")
    .single();

  if (error || !vendor) {
    return { error: "Something went wrong creating that listing. Please try again." };
  }

  redirect(`/vendors/${vendor.id}`);
}
