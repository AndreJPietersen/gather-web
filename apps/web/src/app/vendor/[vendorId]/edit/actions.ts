"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callerFromCookies } from "@/server/context";
import { updateVendorBusiness as update } from "@/server/services/vendors";

export interface EditVendorState {
  error?: string;
}

// Thin wrapper: the rules (RLS-checked update, the category clash check)
// live in src/server/services/vendors.ts, shared with the native apps' API.
export async function updateVendorBusiness(_prevState: EditVendorState, formData: FormData): Promise<EditVendorState> {
  const caller = await callerFromCookies();
  if (!caller) redirect("/login");

  const result = await update(caller, {
    vendorId: formData.get("vendorId"),
    name: formData.get("name"),
    primaryCategory: formData.get("primaryCategory"),
    description: formData.get("description"),
    phone: formData.get("phone"),
    website: formData.get("website"),
  });
  if (!result.ok) return { error: result.message };
  redirect(`/vendor/${result.data.vendorId}/dashboard`);
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
