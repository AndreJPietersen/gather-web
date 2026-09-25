import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { StarRating } from "./star-rating";
import { vendorInitials } from "@gather/shared/vendor-gradient";
import type { ReviewRow } from "@/lib/vendor-reviews";

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { dateStyle: "medium" });
}

// One review + its reply (if any), reused as-is on the public profile
// teaser, the full "See all reviews" list, and the vendor's own dashboard.
// `replySlot` lets the dashboard swap the plain read-only reply block for
// its own interactive ReplyForm (open composer / collapsed-with-Edit) —
// omitted everywhere else, where a reply (if any) is always read-only.
// `vendorInitials` (lib/vendor-gradient.ts) is reused here despite its
// name — the algorithm itself (first letters of the first two words) has
// nothing vendor-specific about it.
export function ReviewCard({ review, replySlot }: { review: ReviewRow; replySlot?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-primary-soft font-display text-[13px] font-semibold text-primary">
          {vendorInitials(review.reviewerName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-extrabold text-text">{review.reviewerName}</p>
          <StarRating rating={review.rating} size={11} className="mt-0.5" />
        </div>
        <span className="shrink-0 text-[11px] font-bold text-text-muted">{formatReviewDate(review.createdAt)}</span>
      </div>

      {review.reviewText && <p className="text-[13px] font-semibold leading-relaxed text-text">{review.reviewText}</p>}

      {replySlot ??
        (review.reply && (
          <div className="ml-5 mt-1 rounded-[14px] bg-primary-soft px-3 py-2.5">
            <p className="text-[11px] font-extrabold text-primary">Reply</p>
            <p className="text-xs font-semibold text-text">{review.reply.replyText}</p>
          </div>
        ))}
    </Card>
  );
}
