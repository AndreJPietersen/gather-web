export type PlacementStatus = "pending" | "activated" | "cancelled";
export type PlacementState = "live" | "scheduled" | "pending" | "ended" | "cancelled";

// What an admin sees for a placement, worked out from the stored status plus
// today's date rather than stored itself: nothing in this stack runs on a
// schedule, so a stored "expired" flag would only ever be as fresh as the
// last time someone happened to edit the row. The same rule lives in SQL as
// public.is_featured() — a placement is live for the public exactly when its
// state here is "live". Dates are YYYY-MM-DD in South African time,
// inclusive on both ends, so plain string comparison is correct.
export function getPlacementState(
  placement: { status: PlacementStatus; starts_on: string; ends_on: string },
  today: string,
): PlacementState {
  if (placement.status === "cancelled") return "cancelled";
  if (placement.status === "pending") return "pending";
  if (today < placement.starts_on) return "scheduled";
  if (today > placement.ends_on) return "ended";
  return "live";
}

export const PLACEMENT_STATE_LABELS: Record<PlacementState, string> = {
  live: "Live",
  scheduled: "Scheduled",
  pending: "Pending",
  ended: "Ended",
  cancelled: "Cancelled",
};

export const PLACEMENT_STATE_CLASSES: Record<PlacementState, string> = {
  live: "bg-success-soft text-ink",
  scheduled: "bg-primary-soft text-primary",
  pending: "bg-secondary-soft text-ink",
  ended: "bg-surface text-text-muted border-2 border-border",
  cancelled: "bg-surface text-text-muted border-2 border-border",
};

export function describePosition(position: number | null): string {
  return position === null ? "Rotating" : `#${position}`;
}
