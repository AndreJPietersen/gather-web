import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { StarRating } from "./star-rating";
import type { RatingSummary } from "@/lib/vendor-reviews";

// Shared by the public vendor profile, the full reviews list, and the
// vendor's own dashboard — same average/count/breakdown treatment
// everywhere, with a `children` slot for whichever CTA (or none) belongs on
// that particular surface.
export function RatingSummaryCard({ summary, title, children }: { summary: RatingSummary; title?: string; children?: ReactNode }) {
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
