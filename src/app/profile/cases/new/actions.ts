"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supportCaseCategoryLabel } from "@/lib/support-case-categories";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const schema = z.object({
  category: z.enum(["payments_billing", "vendor_booking", "event_setup", "account_verification", "app_bug", "other"], {
    message: "Please choose what this is about.",
  }),
  description: z.string().trim().min(10, "Please give us a few more details.").max(2000),
});

export interface NewSupportCaseState {
  error?: string;
}

// The self-service counterpart to admin/cases/new's createCase — see
// docs/gather_web_admin_architecture.md's Open Questions #2. No subject
// field: the category's own label doubles as the case's short title, so the
// form only ever asks for the three things Andre actually wants (category,
// free text, optional image), not a redundant headline on top.
//
// Upload happens before the insert, keyed by the reporting user's own id
// (not the case id, which doesn't exist yet) — see the
// support-case-attachments bucket migration for why — and is rolled back if
// the insert that follows it fails, same as uploadEventGalleryImage's own
// upload-then-insert-then-rollback shape.
export async function createSupportCase(_prevState: NewSupportCaseState, formData: FormData): Promise<NewSupportCaseState> {
  const parsed = schema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { error: "Please upload a JPEG, PNG, or WebP image." };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { error: "That image is too large — please keep it under 5MB." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired — please log in again." };
  }

  let attachmentPath: string | null = null;
  if (hasFile) {
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("support-case-attachments").upload(path, file, {
      contentType: file.type,
    });
    if (uploadError) {
      return { error: "Couldn't upload that image. Please try again." };
    }
    attachmentPath = path;
  }

  const { category, description } = parsed.data;
  const { data: created, error } = await supabase
    .from("support_cases")
    .insert({
      subject: supportCaseCategoryLabel(category),
      description,
      category,
      attachment_path: attachmentPath,
      requester_id: user.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    if (attachmentPath) {
      await supabase.storage.from("support-case-attachments").remove([attachmentPath]);
    }
    return { error: "Something went wrong submitting that. Please try again." };
  }

  redirect(`/profile/cases/${created.id}`);
}
