"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_GALLERY_IMAGES } from "@/lib/gallery-limits";
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/image-upload-limits";
import { friendlyWriteError } from "@/lib/db-errors";
import { getVendorAccess } from "../access";

const quoteSchema = z.object({
  eventVendorId: z.string().uuid(),
  vendorId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});

export interface SubmitQuoteState {
  error?: string;
}

// Owner/Manager send a quote straight to the planner. Staff can only
// *suggest* one: it's saved as a draft carrying their id (suggested_by),
// which the planner side can't see, until an Owner/Manager sends or
// discards it. vendor_quotes_insert_vendor_manager enforces the same split in
// the database — the role check here only picks which kind to write.
export async function submitQuote(_prevState: SubmitQuoteState, formData: FormData): Promise<SubmitQuoteState> {
  const parsed = quoteSchema.safeParse({
    eventVendorId: formData.get("eventVendorId"),
    vendorId: formData.get("vendorId"),
    amount: formData.get("amount"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { eventVendorId, vendorId, amount, description } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired — please log in again." };
  const access = await getVendorAccess(vendorId, user.id);
  if (!access.isTeamMember) return { error: "You're not on this business's team." };
  const isSuggestion = access.role === "staff";

  const { error } = await supabase.from("vendor_quotes").insert({
    event_vendor_id: eventVendorId,
    amount,
    description: description || null,
    status: isSuggestion ? "draft" : "sent",
    created_by_vendor: true,
    suggested_by: isSuggestion ? user.id : null,
  });

  if (error) {
    return { error: friendlyWriteError(error, "Something went wrong saving that quote. Please try again.") };
  }

  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/dashboard/bookings`);
  return {};
}

// A Manager/Owner approving a Staff suggestion: draft → sent, which is the
// moment the planner can see it. The status rules on vendor_quotes only let
// the vendor side move a quote to 'sent' or keep it a 'draft'.
export async function sendSuggestedQuote(formData: FormData): Promise<void> {
  const parsed = z.object({ quoteId: z.string().uuid(), vendorId: z.string().uuid() }).safeParse({
    quoteId: formData.get("quoteId"),
    vendorId: formData.get("vendorId"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("vendor_quotes").update({ status: "sent" }).eq("id", parsed.data.quoteId).eq("status", "draft");
  revalidatePath(`/vendor/${parsed.data.vendorId}/dashboard`);
  revalidatePath(`/vendor/${parsed.data.vendorId}/dashboard/bookings`);
}

// Discarding a suggestion (Owner/Manager) or withdrawing your own (Staff).
// Only drafts can ever be deleted — vendor_quotes_delete_draft.
export async function discardSuggestedQuote(formData: FormData): Promise<void> {
  const parsed = z.object({ quoteId: z.string().uuid(), vendorId: z.string().uuid() }).safeParse({
    quoteId: formData.get("quoteId"),
    vendorId: formData.get("vendorId"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("vendor_quotes").delete().eq("id", parsed.data.quoteId).eq("status", "draft");
  revalidatePath(`/vendor/${parsed.data.vendorId}/dashboard/bookings`);
}

const noteSchema = z.object({
  eventVendorId: z.string().uuid(),
  vendorId: z.string().uuid(),
  body: z.string().trim().max(2000, "Keep the note under 2000 characters."),
});

export interface BookingNoteState {
  error?: string;
  saved?: boolean;
}

// The vendor team's private note on a booking — any team member, Staff
// included, can write it; the planner side never sees it (RLS on
// vendor_booking_notes has only a vendor-team branch).
export async function saveBookingNote(_prev: BookingNoteState, formData: FormData): Promise<BookingNoteState> {
  const parsed = noteSchema.safeParse({
    eventVendorId: formData.get("eventVendorId"),
    vendorId: formData.get("vendorId"),
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the note." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired — please log in again." };

  const { error } = await supabase.from("vendor_booking_notes").upsert(
    {
      event_vendor_id: parsed.data.eventVendorId,
      body: parsed.data.body,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_vendor_id" },
  );
  if (error) return { error: friendlyWriteError(error, "Couldn't save that note. Please try again.") };
  revalidatePath(`/vendor/${parsed.data.vendorId}/dashboard/bookings`);
  return { saved: true };
}

const serviceSchema = z.object({
  vendorId: z.string().uuid(),
  name: z.string().trim().min(2, "Name is too short").max(150),
  categoryId: z.string().uuid("Please choose a category"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});

export interface ServiceFormState {
  error?: string;
}

export async function addService(_prevState: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const parsed = serviceSchema.safeParse({
    vendorId: formData.get("vendorId"),
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { vendorId, name, categoryId, description } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("vendor_services").insert({
    vendor_id: vendorId,
    name,
    category_id: categoryId,
    description: description || null,
  });

  if (error) {
    return { error: "Something went wrong adding that listing. Please try again." };
  }

  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/dashboard/services`);
  revalidatePath(`/vendor/${vendorId}/edit`);
  return {};
}

export async function removeService(formData: FormData): Promise<void> {
  const serviceId = formData.get("serviceId");
  const vendorId = formData.get("vendorId");
  if (typeof serviceId !== "string" || typeof vendorId !== "string") return;

  const supabase = await createClient();
  await supabase.from("vendor_services").delete().eq("id", serviceId);

  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/dashboard/services`);
  revalidatePath(`/vendor/${vendorId}/edit`);
}

const socialLinkSchema = z.object({
  vendorId: z.string().uuid(),
  platform: z.string().trim().min(1, "Platform is required").max(50),
  url: z.string().trim().url("That doesn't look like a valid URL").max(500),
});

export interface SocialLinkFormState {
  error?: string;
}

// RLS (vendor_social_links_insert_owner_or_manager_if_verified) is the real
// enforcement of "verified vendors only" — this doesn't re-check
// verification_status itself, since a stale/forged client request would
// just get rejected at the database regardless of what this function
// assumes. The UI still hides the form for unverified vendors (see
// dashboard/page.tsx) so nobody sees an option that would only ever fail.
export async function addSocialLink(_prevState: SocialLinkFormState, formData: FormData): Promise<SocialLinkFormState> {
  const parsed = socialLinkSchema.safeParse({
    vendorId: formData.get("vendorId"),
    platform: formData.get("platform"),
    url: formData.get("url"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const { vendorId, platform, url } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("vendor_social_links").insert({ vendor_id: vendorId, platform, url });

  if (error) {
    return { error: "Something went wrong adding that link. Only verified vendors can add social links." };
  }

  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/dashboard/social-links`);
  revalidatePath(`/vendor/${vendorId}/edit`);
  revalidatePath(`/vendors/${vendorId}`);
  return {};
}

export async function removeSocialLink(formData: FormData): Promise<void> {
  const linkId = formData.get("linkId");
  const vendorId = formData.get("vendorId");
  if (typeof linkId !== "string" || typeof vendorId !== "string") return;

  const supabase = await createClient();
  await supabase.from("vendor_social_links").delete().eq("id", linkId);

  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/dashboard/social-links`);
  revalidatePath(`/vendor/${vendorId}/edit`);
  revalidatePath(`/vendors/${vendorId}`);
}

export interface GalleryUploadState {
  error?: string;
}

// Uses the request-scoped client, not the service role, for both the
// Storage upload and the vendor_gallery_images insert — the whole point is
// that Postgres RLS and the storage.objects policies (supabase/migrations)
// are what actually enforce "verified vendors only," not this function's
// own logic. A stale/forged request just gets rejected at the database
// either way; the file-type/size checks here are for a fast, friendly error
// message, not the real security boundary.
export async function uploadVendorGalleryImage(
  _prevState: GalleryUploadState,
  formData: FormData,
): Promise<GalleryUploadState> {
  const vendorId = formData.get("vendorId");
  const caption = formData.get("caption");
  const file = formData.get("file");

  if (typeof vendorId !== "string" || !z.string().uuid().safeParse(vendorId).success) {
    return { error: "Something went wrong. Please try again." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a photo to upload." };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Please upload a JPEG, PNG, or WebP image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "That image is too large — please keep it under 5MB." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired — please log in again." };
  }

  const { count } = await supabase
    .from("vendor_gallery_images")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId);
  if ((count ?? 0) >= MAX_GALLERY_IMAGES) {
    return { error: `This gallery is at its ${MAX_GALLERY_IMAGES}-photo limit. Remove a photo to add a new one.` };
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${vendorId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("vendor-gallery").upload(path, file, {
    contentType: file.type,
  });
  if (uploadError) {
    return { error: "Couldn't upload that photo — only verified vendors can add gallery photos. Please try again." };
  }

  const { error: insertError } = await supabase.from("vendor_gallery_images").insert({
    vendor_id: vendorId,
    storage_path: path,
    caption: typeof caption === "string" && caption.trim() ? caption.trim() : null,
    created_by: user.id,
  });

  if (insertError) {
    // Best-effort cleanup of the now-orphaned file — not itself
    // error-checked, since there's nothing more to do if this also fails.
    await supabase.storage.from("vendor-gallery").remove([path]);
    return { error: "Something went wrong saving that photo. Please try again." };
  }

  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/dashboard/gallery`);
  revalidatePath(`/vendor/${vendorId}/edit`);
  revalidatePath(`/vendors/${vendorId}`);
  return {};
}

export async function removeVendorGalleryImage(formData: FormData): Promise<void> {
  const imageId = formData.get("imageId");
  const vendorId = formData.get("vendorId");
  const storagePath = formData.get("storagePath");
  if (typeof imageId !== "string" || typeof vendorId !== "string" || typeof storagePath !== "string") return;

  const supabase = await createClient();
  const { error } = await supabase.from("vendor_gallery_images").delete().eq("id", imageId);
  if (!error) {
    await supabase.storage.from("vendor-gallery").remove([storagePath]);
  }

  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/dashboard/gallery`);
  revalidatePath(`/vendor/${vendorId}/edit`);
  revalidatePath(`/vendors/${vendorId}`);
}
