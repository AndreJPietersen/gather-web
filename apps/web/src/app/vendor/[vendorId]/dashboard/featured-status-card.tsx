import Link from "next/link";
import { formatEventDate } from "@gather/shared/utils";
import { durationLabel, nextDay, spotLabel } from "@gather/shared/feature-pricing";
import type { VendorFeatureStatus } from "@/lib/vendor-feature-status";

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

// The dashboard's featured-placement card, in one of three states: an
// invitation to request a spot (owners only — nothing is shown to a Manager
// or Staff member who couldn't act on it), a pending request, or a live /
// scheduled placement with how long it has left.
export function FeaturedStatusCard({
  vendorId,
  status,
  isOwner,
  today,
}: {
  vendorId: string;
  status: VendorFeatureStatus;
  isOwner: boolean;
  today: string;
}) {
  if (status.pending) {
    return (
      <Link href={`/vendor/${vendorId}/featured`} className="flex flex-col gap-1 rounded-[20px] border-2 border-border bg-surface p-4">
        <span className="flex items-center justify-between">
          <span className="font-display text-[15px] font-semibold text-ink">Featured request</span>
          <span className="rounded-pill bg-secondary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">Pending</span>
        </span>
        <span className="text-xs font-semibold text-text-muted">
          {status.pending.requestedSpot ? spotLabel(status.pending.requestedSpot) : "Featured spot"}
          {status.pending.requestedDuration ? ` · ${durationLabel(status.pending.requestedDuration)}` : ""} from{" "}
          {formatEventDate(status.pending.startsOn)}. Gather will confirm the price and dates before anything goes live.
        </span>
      </Link>
    );
  }

  if (status.current) {
    const { startsOn, endsOn, state } = status.current;
    const total = dayNumber(endsOn) - dayNumber(startsOn) + 1;
    const done = Math.min(total, Math.max(0, dayNumber(today) - dayNumber(startsOn) + 1));
    const left = total - done;
    return (
      <div className="flex flex-col gap-2 rounded-[20px] border-2 border-border bg-surface p-4">
        <span className="flex items-center justify-between">
          <span className="font-display text-[15px] font-semibold text-ink">{state === "live" ? "You're featured" : "Featured spot booked"}</span>
          <span className="rounded-pill bg-success-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">
            {state === "live" ? "Live" : "Scheduled"}
          </span>
        </span>
        {state === "live" ? (
          <>
            <span className="text-xs font-semibold text-text-muted">Until {formatEventDate(endsOn)}</span>
            <span className="h-1.5 overflow-hidden rounded-pill bg-bg">
              <span
                className="block h-full rounded-pill bg-[linear-gradient(90deg,var(--color-primary),var(--color-primary-glow))]"
                style={{ width: `${Math.round((done / total) * 100)}%` }}
              />
            </span>
            <span className="flex justify-between text-[11px] font-extrabold text-ink">
              <span>
                {done} {done === 1 ? "day" : "days"} in
              </span>
              <span className="text-text-muted">
                {left} {left === 1 ? "day" : "days"} left
              </span>
            </span>
          </>
        ) : (
          <span className="text-xs font-semibold text-text-muted">
            From {formatEventDate(startsOn)} to {formatEventDate(endsOn)}
          </span>
        )}
        {isOwner && (
          <Link href={`/vendor/${vendorId}/featured?start=${nextDay(endsOn)}`} className="w-fit text-xs font-extrabold text-primary">
            Extend
          </Link>
        )}
      </div>
    );
  }

  if (!isOwner) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-glow))] p-4 text-white">
      <span className="font-display text-[15px] font-semibold">★ Get featured</span>
      <span className="text-xs font-bold text-white/90">
        Sit at the top of the marketplace and the home page, next to vendors planners already trust.
      </span>
      <Link href={`/vendor/${vendorId}/featured`} className="mt-1 w-fit rounded-pill bg-white px-4 py-2 text-xs font-extrabold text-primary">
        Request a spot
      </Link>
    </div>
  );
}
