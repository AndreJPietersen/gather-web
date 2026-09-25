"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MAX_GALLERY_IMAGES } from "@gather/shared/gallery-limits";
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from "@gather/shared/image-upload-limits";

export interface GalleryUploadState {
  error?: string;
}

// Uses the request-scoped client for both the Storage upload and the
// event_gallery_images insert, same reasoning as the vendor gallery's
// upload action — the storage.objects policies and this table's own RLS
// (owner-or-editor) are the real enforcement, not this function's logic.
// Unlike vendor-gallery (public bucket), event-gallery is private — nothing
// here returns a permanent public URL; display always goes through a
// signed URL generated per request in page.tsx.
export async function uploadEventGalleryImage(
  _prevState: GalleryUploadState,
  formData: FormData,
): Promise<GalleryUploadState> {
  const eventId = formData.get("eventId");
  const caption = formData.get("caption");
  const file = formData.get("file");

  if (typeof eventId !== "string" || !z.string().uuid().safeParse(eventId).success) {
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
    .from("event_gallery_images")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if ((count ?? 0) >= MAX_GALLERY_IMAGES) {
    return { error: `This gallery is at its ${MAX_GALLERY_IMAGES}-photo limit. Remove a photo to add a new one.` };
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${eventId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("event-gallery").upload(path, file, {
    contentType: file.type,
  });
  if (uploadError) {
    return { error: "Couldn't upload that photo. Please try again." };
  }

  const { error: insertError } = await supabase.from("event_gallery_images").insert({
    event_id: eventId,
    storage_path: path,
    caption: typeof caption === "string" && caption.trim() ? caption.trim() : null,
    created_by: user.id,
  });

  if (insertError) {
    await supabase.storage.from("event-gallery").remove([path]);
    return { error: "Something went wrong saving that photo. Please try again." };
  }

  revalidatePath(`/events/${eventId}/gallery`);
  return {};
}

export async function removeEventGalleryImage(formData: FormData): Promise<void> {
  const imageId = formData.get("imageId");
  const eventId = formData.get("eventId");
  const storagePath = formData.get("storagePath");
  if (typeof imageId !== "string" || typeof eventId !== "string" || typeof storagePath !== "string") return;

  const supabase = await createClient();
  const { error } = await supabase.from("event_gallery_images").delete().eq("id", imageId);
  if (!error) {
    await supabase.storage.from("event-gallery").remove([storagePath]);
  }

  revalidatePath(`/events/${eventId}/gallery`);
}
