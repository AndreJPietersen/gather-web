import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { RatingSummaryCard } from "@/components/vendor/rating-summary-card";
import { ReviewCard } from "@/components/vendor/review-card";
import { createClient } from "@/lib/supabase/server";
import { getVendorAccess } from "../../access";
import { getVendorRatingSummary, getVendorReviews } from "@/lib/vendor-reviews";
import { ReplyForm } from "./reply-form";

export default async function VendorDashboardReviewsPage({ params }: PageProps<"/vendor/[vendorId]/dashboard/reviews">) {
  const { vendorId } = await params;
  const supabase = await createClient();

  const { data: vendor } = await supabase.from("vendors").select("id, name").eq("id", vendorId).maybeSingle<{ id: string; name: string }>();
  if (!vendor) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getVendorAccess(vendorId, user?.id ?? null);
  if (!access.isTeamMember) {
    notFound();
  }
  const canReply = access.role === "owner" || access.role === "manager";

  const [summary, reviews] = await Promise.all([getVendorRatingSummary(supabase, vendor.id), getVendorReviews(supabase, vendor.id)]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Reviews">
        <p className="text-sm font-semibold text-text-muted">See what planners are saying about you</p>
      </PageHeader>

      <RatingSummaryCard summary={summary} />

      <StaggerList className="flex flex-col gap-2.5">
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <StaggerItem key={review.id}>
              <ReviewCard
                review={review}
                replySlot={
                  canReply ? (
                    <ReplyForm
                      key={`${review.id}-${review.reply?.replyText ?? "none"}`}
                      vendorId={vendor.id}
                      reviewId={review.id}
                      existingReply={review.reply?.replyText ?? null}
                    />
                  ) : undefined
                }
              />
            </StaggerItem>
          ))
        ) : (
          <Card>
            <p className="text-sm font-semibold text-text-muted">No reviews yet.</p>
          </Card>
        )}
      </StaggerList>
    </main>
  );
}
