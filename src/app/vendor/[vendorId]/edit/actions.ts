"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sameCategory } from "@/lib/vendor-business-rules";

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

  // The one-business-per-category owner rule (src/lib/vendor-business-rules.ts)
  // would be pointless if a business could simply be re-categorised after
  // creation, so a category *change* is checked against every other
  // business this one's Owners own. Read through the service role: the
  // editor can't see other owners' memberships of other businesses. An
  // unchanged category is never re-checked, so a business created through
  // an approved exception keeps saving normally.
  const { data: current } = await supabase.from("vendors").select("primary_category").eq("id", vendorId).maybeSingle();
  if (primaryCategory && current && !sameCategory(current.primary_category, primaryCategory)) {
    const clash = await findCategoryClash(vendorId, primaryCategory);
    if (clash) {
      return {
        error: `An owner of this business already owns ${clash}, which is also ${primaryCategory}. Each owner can have one business per category — report an issue from your Profile if you need an exception.`,
      };
    }
  }

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

// Returns the name of another business, owned by one of this business's
// Owners, already in the given category — or null if there's no clash.
async function findCategoryClash(vendorId: string, category: string): Promise<string | null> {
  const service = createServiceClient();
  const { data: owners } = await service
    .from("vendor_team_members")
    .select("user_id")
    .eq("vendor_id", vendorId)
    .eq("role", "owner")
    .eq("is_active", true);
  const ownerIds = (owners ?? []).map((o) => o.user_id);
  if (ownerIds.length === 0) return null;

  const { data: others } = await service
    .from("vendor_team_members")
    .select("vendors(name, primary_category)")
    .in("user_id", ownerIds)
    .eq("role", "owner")
    .eq("is_active", true)
    .neq("vendor_id", vendorId)
    .returns<{ vendors: { name: string; primary_category: string | null } | null }[]>();
  const clash = (others ?? []).find((row) => sameCategory(row.vendors?.primary_category, category));
  return clash?.vendors?.name ?? null;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface LogoUploadState {
  error?: string;
}

// Same upload-then-insert-then-rollback shape every other Storage feature
// in this app uses, simplified by one step since there's no separate DB
// row — just the one vendors.logo_path column. Storage upload happens
// first (RLS there is owner/manager only, no verification gate — see
// logoPath's own comment in schema.ts), then the column update; the
// uploaded file is removed again if that update fails, and the previous
// logo (if any) is removed after a successful replace so old files don't
// pile up.
export async function uploadVendorLogo(_prevState: LogoUploadState, formData: FormData): Promise<LogoUploadState> {
  const vendorId = formData.get("vendorId");
  const file = formData.get("file");

  if (typeof vendorId !== "string" || !z.string().uuid().safeParse(vendorId).success) {
    return { error: "Something went wrong. Please try again." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a photo to upload." };
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: "Please upload a JPEG, PNG, or WebP image." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "That image is too large — please keep it under 2MB." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase.from("vendors").select("logo_path").eq("id", vendorId).maybeSingle();

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${vendorId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("vendor-logos").upload(path, file, {
    contentType: file.type,
  });
  if (uploadError) {
    return { error: "Couldn't upload that image. Please try again." };
  }

  const { error: updateError } = await supabase.from("vendors").update({ logo_path: path }).eq("id", vendorId);
  if (updateError) {
    await supabase.storage.from("vendor-logos").remove([path]);
    return { error: "Something went wrong saving your logo. Please try again." };
  }

  if (existing?.logo_path) {
    await supabase.storage.from("vendor-logos").remove([existing.logo_path]);
  }

  revalidatePath(`/vendor/${vendorId}/edit`);
  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");
  revalidatePath("/");
  return {};
}
