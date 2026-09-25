import { cn } from "@gather/shared/utils";

// The card-sized sibling of RatingSummaryCard/StarRating — a single small
// star + the average, with the review count in parentheses where there's
// room for it. Deliberately not the full 5-star row: at card scale (a
// 28–44px avatar next to it) five separate star icons would either be
// illegibly tiny or crowd out the vendor's own name, so one star + a
// number reads the same way a map-pin rating badge does on any other
// marketplace app. `light` flips to a white-on-transparent treatment for
// the two gradient/Featured card backgrounds this renders on.
export function VendorRatingBadge({
  average,
  count,
  light = false,
  className,
}: {
  average: number;
  count: number;
  light?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-extrabold", light ? "text-white/90" : "text-text-muted", className)}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-secondary)">
        <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2" />
      </svg>
      {average.toFixed(1)}
      <span className={light ? "text-white/70" : "text-text-muted"}>({count})</span>
    </span>
  );
}
