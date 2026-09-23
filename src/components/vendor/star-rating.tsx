import { cn } from "@/lib/utils";

// One polygon, reused at every size this app shows a star at — the same
// shape already used for the Featured badge's icon, so a filled star reads
// as visually "the same star" wherever it appears rather than mixing icon
// families.
function Star({ size, filled }: { size: number; filled: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "var(--color-secondary)" : "var(--color-border)"}>
      <polygon points="12 2 15.09 8.63 22 9.24 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.24 8.91 8.63 12 2" />
    </svg>
  );
}

// Rounds to the nearest whole star for display — a fractional average
// (4.8) shows as 5 filled, not a half-filled star, the same simplification
// most star-rating UIs make rather than rendering true fractional fills.
export function StarRating({ rating, size = 14, className }: { rating: number; size?: number; className?: string }) {
  const filledCount = Math.round(rating);
  return (
    <div className={cn("flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} filled={n <= filledCount} />
      ))}
    </div>
  );
}
