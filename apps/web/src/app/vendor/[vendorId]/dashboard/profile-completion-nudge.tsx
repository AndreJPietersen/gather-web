import Link from "next/link";
import { getVendorCompletion, type VendorCompletionInput } from "@gather/shared/vendor-completion";

// The dashboard's own condensed one-line version of ProfileCompletionCard's
// full checklist (which now lives at the top of the Edit page — the
// "Business Profile" tile's destination) — a launch-grid dashboard has no
// room for the whole checklist without recreating the clutter this
// redesign exists to remove, but the percentage itself is too strong a
// motivator to bury a tap deeper than the dashboard's own header.
export function ProfileCompletionNudge({ vendorId, input }: { vendorId: string; input: VendorCompletionInput }) {
  const completion = getVendorCompletion(input);

  return (
    <Link
      href={`/vendor/${vendorId}/edit`}
      className="flex items-center gap-3 rounded-[22px] bg-surface p-4 shadow-[0_6px_16px_-8px_var(--color-ink)]"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-extrabold text-text">Profile {completion.percent}% complete</span>
          <span className="font-display text-[13px] font-semibold text-primary">{completion.percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-pill bg-bg">
          <div
            className="h-full rounded-pill bg-[linear-gradient(90deg,var(--color-primary),var(--color-primary-glow))]"
            style={{ width: `${completion.percent}%` }}
          />
        </div>
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </Link>
  );
}
