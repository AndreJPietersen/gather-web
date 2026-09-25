export type FeatureSpot = "top" | "rotating";
export type FeatureDuration = "1_week" | "1_month" | "3_months";

export const FEATURE_SPOTS: { id: FeatureSpot; label: string; description: string }[] = [
  { id: "top", label: "Top spot", description: "A fixed place at the front of the featured row, if one is free." },
  { id: "rotating", label: "Rotating", description: "Shares the featured row; the order changes each day." },
];

export const FEATURE_DURATIONS: { id: FeatureDuration; label: string }[] = [
  { id: "1_week", label: "1 week" },
  { id: "1_month", label: "1 month" },
  { id: "3_months", label: "3 months" },
];

export const spotLabel = (spot: FeatureSpot) => FEATURE_SPOTS.find((s) => s.id === spot)?.label ?? spot;
export const durationLabel = (duration: FeatureDuration) => FEATURE_DURATIONS.find((d) => d.id === duration)?.label ?? duration;

export interface FeaturePriceRow {
  spot: FeatureSpot;
  duration: FeatureDuration;
  amount: string | null;
}

// Looks up one cell of the admin-managed price list; null means no price set
// yet, which every screen shows as "Price on request".
export function findPrice(prices: FeaturePriceRow[], spot: FeatureSpot, duration: FeatureDuration): string | null {
  return prices.find((p) => p.spot === spot && p.duration === duration)?.amount ?? null;
}

// The inclusive last day of a placement that starts on `startsOn`
// (YYYY-MM-DD). A week is 7 days including the first; a month runs to the day
// before the same date next month (1 Oct → 31 Oct), clamped for short months
// (31 Jan → 28 Feb, the day before "31 Feb" rolls over). Pure date math in
// UTC so no timezone can shift the result.
export function endDateFor(startsOn: string, duration: FeatureDuration): string {
  const [y, m, d] = startsOn.split("-").map(Number);
  if (duration === "1_week") {
    return new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);
  }
  const months = duration === "1_month" ? 1 : 3;
  const targetMonthLastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  const sameDayNextPeriod = new Date(Date.UTC(y, m - 1 + months, Math.min(d, targetMonthLastDay)));
  if (d > targetMonthLastDay) {
    // The start day does not exist in the target month, so the period simply
    // ends on that month's last day.
    return sameDayNextPeriod.toISOString().slice(0, 10);
  }
  return new Date(sameDayNextPeriod.getTime() - 86_400_000).toISOString().slice(0, 10);
}

// The day after a date (YYYY-MM-DD) — used to start an extension right after
// a placement ends.
export function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
