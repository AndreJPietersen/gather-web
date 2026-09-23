import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, LinkCard } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { RatingSummaryCard } from "@/components/vendor/rating-summary-card";
import { ReviewCard } from "@/components/vendor/review-card";
import { createClient } from "@/lib/supabase/server";
import { getVendorRatingSummary, getVendorReviews, getEligibleBookingForReview } from "@/lib/vendor-reviews";

export default async function VendorReviewsPage({ params }: PageProps<"/vendors/[id]/reviews">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase.from("vendors").select("id, name").eq("id", id).maybeSingle<{ id: string; name: string }>();
  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [summary, reviews, eligibleBooking] = await Promise.all([
    getVendorRatingSummary(supabase, vendor.id),
    getVendorReviews(supabase, vendor.id),
    user ? getEligibleBookingForReview(supabase, vendor.id, user.id) : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Reviews">
        <p className="text-sm font-semibold text-text-muted">{vendor.name}</p>
      </PageHeader>

      <RatingSummaryCard summary={summary} />

      <StaggerList className="flex flex-col gap-2.5">
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <StaggerItem key={review.id}>
              <ReviewCard review={review} />
            </StaggerItem>
          ))
        ) : eligibleBooking ? (
          <LinkCard href={`/vendors/${vendor.id}/reviews/write`}>
            <p className="text-sm font-semibold text-text-muted">No reviews yet — tap to write the first one.</p>
          </LinkCard>
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No reviews yet.</p>
          </Card>
        )}
      </StaggerList>
    </main>
  );
}
