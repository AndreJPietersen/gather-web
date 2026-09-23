import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getEligibleBookingForReview } from "@/lib/vendor-reviews";
import { WriteReviewForm } from "./write-review-form";

// The eligible booking (most recent contracted, or the most recent already-
// reviewed one to edit) is computed server-side here, not passed in — a
// direct visit to this URL re-derives eligibility fresh rather than
// trusting whatever the profile page's CTA last rendered, since RLS would
// reject the write anyway if this were stale.
export default async function WriteReviewPage({ params }: PageProps<"/vendors/[id]/reviews/write">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase.from("vendors").select("id, name").eq("id", id).maybeSingle<{ id: string; name: string }>();
  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/vendors/${id}`);
  }

  const eligible = await getEligibleBookingForReview(supabase, vendor.id, user.id);
  if (!eligible) {
    redirect(`/vendors/${id}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title={eligible.existingReview ? "Edit Your Review" : "Write a Review"}>
        <p className="text-sm font-semibold text-text-muted">
          {vendor.name} — for {eligible.eventName}
        </p>
      </PageHeader>

      <WriteReviewForm
        vendorId={vendor.id}
        eventVendorId={eligible.eventVendorId}
        initialRating={eligible.existingReview?.rating ?? 0}
        initialText={eligible.existingReview?.reviewText ?? ""}
      />
    </main>
  );
}
