"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  vendorId: z.string().uuid(),
  reviewId: z.string().uuid(),
  replyText: z.string().trim().min(1, "Write a reply first").max(1000),
});

export interface ReplyFormState {
  error?: string;
  success?: boolean;
}

// Insert-or-edit-in-place, keyed on vendor_review_replies' own
// one-reply-per-review unique constraint — any Owner/Manager teammate may
// post or edit it, not just whoever wrote it first, same team-owned
// posture as removeService/removeSocialLink. RLS
// (vendor_review_replies_insert_vendor_manager / _update_vendor_manager)
// is the real authorization; this only validates shape.
export async function replyToReview(_prevState: ReplyFormState, formData: FormData): Promise<ReplyFormState> {
  const parsed = schema.safeParse({
    vendorId: formData.get("vendorId"),
    reviewId: formData.get("reviewId"),
    replyText: formData.get("replyText"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your reply." };
  }

  const { vendorId, reviewId, replyText } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired — please log in again." };
  }

  const { error } = await supabase.from("vendor_review_replies").upsert(
    {
      vendor_review_id: reviewId,
      reply_text: replyText,
      replied_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "vendor_review_id" },
  );

  if (error) {
    return { error: "Something went wrong posting your reply. Please try again." };
  }

  revalidatePath(`/vendor/${vendorId}/dashboard/reviews`);
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath(`/vendors/${vendorId}/reviews`);
  return { success: true };
}
