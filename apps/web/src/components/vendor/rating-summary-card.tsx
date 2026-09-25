import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { StarRating } from "./star-rating";
import type { RatingSummary } from "@/lib/vendor-reviews";

// Shared by the public vendor profile, the full reviews list, and the
// vendor's own dashboard — same average/count/breakdown treatment
// everywhere, with a `children` slot for whichever CTA (or none) belongs on
// that particular surface. hideEmptyState is for callers that already
// render their own (often richer — e.g. a "tap to write the first one"
// link) zero-reviews message right below this card: the public profile
// page has no such message of its own, so it needs this card's built-in
// one; the two full reviews-list pages do, and previously showed both at
// once.
export function RatingSummaryCard({
  summary,
  title,
  hideEmptyState,
  children,
}: {
  summary: RatingSummary;
  title?: string;
  hideEmptyState?: boolean;
  children?: ReactNode;
}) {
  // Skip the card entirely rather than rendering an empty shell — its only
  // job in the zero-reviews case is the message hideEmptyState is saying
  // the caller already has elsewhere, and no title/breakdown/children makes
  // sense to show without any actual rating data behind them.
  if (hideEmptyState && summary.count === 0) {
    return null;
  }

  return (
    <Card className="flex flex-col gap-4">
      {title && (
        <div>
          <p className="font-display text-lg font-semibold text-ink">{title}</p>
        </div>
      )}

      {summary.count === 0 ? (
        <p className="text-sm font-semibold text-text-muted">No reviews yet.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex shrink-0 flex-col items-center">
            <span className="font-display text-4xl font-semibold leading-none text-ink">{summary.average.toFixed(1)}</span>
            <StarRating rating={summary.average} size={14} className="mt-1" />
            <span className="mt-0.5 text-[11px] font-bold text-text-muted">
              {summary.count} review{summary.count === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-1">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const pct = summary.count > 0 ? (summary.byStar[star] / summary.count) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-1.5">
                  <span className="w-2.5 text-[10px] font-extrabold text-text-muted">{star}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-bg">
                    <div className="h-full bg-secondary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {children}
    </Card>
  );
}
