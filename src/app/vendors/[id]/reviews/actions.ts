"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  vendorId: z.string().uuid(),
  eventVendorId: z.string().uuid(),
  rating: z.coerce.number().int().min(1, "Please choose a rating").max(5),
  reviewText: z.string().trim().max(1000).optional().or(z.literal("")),
});

export interface ReviewFormState {
  error?: string;
}

// Insert-or-edit-in-place, keyed on the same (event_vendor_id, reviewer_id)
// pair vendor_reviews_one_per_booking_reviewer enforces — a planner writing
// a second review for a booking they already reviewed just updates it,
// same idiom markChatThreadRead's own upsert already uses. RLS
// (vendor_reviews_insert_self / _update_own) is the real authorization on
// both branches; this only re-validates shape for a fast, friendly error.
export async function upsertReview(_prevState: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const parsed = schema.safeParse({
    vendorId: formData.get("vendorId"),
    eventVendorId: formData.get("eventVendorId"),
    rating: formData.get("rating"),
    reviewText: formData.get("reviewText"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your review." };
  }

  const { vendorId, eventVendorId, rating, reviewText } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired — please log in again." };
  }

  const { error } = await supabase.from("vendor_reviews").upsert(
    {
      event_vendor_id: eventVendorId,
      vendor_id: vendorId,
      reviewer_id: user.id,
      rating,
      review_text: reviewText || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_vendor_id,reviewer_id" },
  );

  if (error) {
    return { error: "Something went wrong saving your review. Please try again." };
  }

  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath(`/vendors/${vendorId}/reviews`);
  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/dashboard/reviews`);
  redirect(`/vendors/${vendorId}`);
}
