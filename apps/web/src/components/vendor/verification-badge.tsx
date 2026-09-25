"use client";

import { useState } from "react";
import { BadgeCheck, ShieldQuestion } from "lucide-react";
import { cn } from "@gather/shared/utils";

interface VerificationBadgeProps {
  verified: boolean;
  // The vendor's own description — shown on expand instead of a generic
  // "here's what this badge means" blurb, since that's more useful to a
  // planner browsing the directory (found via direct feedback: a first
  // version showed a canned verification explainer here, which stops being
  // useful after the first time you see it). Falls back to a short status
  // line if the vendor hasn't written one yet.
  description?: string | null;
  className?: string;
}

// Icon-only, always interactive (tap to expand/collapse) — every call site
// is responsible for not nesting this inside another interactive element
// (a <Link>/<LinkCard> row, in particular): a <button> inside an <a> is
// invalid HTML. Where this badge is used on a list row, the row itself is a
// plain Card with the vendor name as its own inner Link, precisely so this
// can sit alongside it as a sibling rather than nested inside it.
//
// The wrapper is `display: contents` (Tailwind's `contents`), not a normal
// box: it makes the button and the expanded paragraph act as direct flex
// children of *this component's parent* row, instead of being trapped
// together inside one flex item. Without it, a row like
// `flex items-center justify-between` has no way to let just the paragraph
// wrap onto its own line — the whole button+paragraph item would either
// stay one inline-sized box (paragraph squashed/overlapping the row's other
// content) or drag the button down with it. `order-last basis-full` on the
// paragraph alone then makes *it* claim the full row width and wrap,
// while the button stays put at its normal small size. Requires the
// parent row to have `flex-wrap` — every call site's Card already does.
export function VerificationBadge({ verified, description, className }: VerificationBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = verified ? BadgeCheck : ShieldQuestion;
  const label = verified ? "Verified" : "Unverified";

  return (
    <div className="contents">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={`${label}. Tap to ${expanded ? "collapse" : "see more"}.`}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-opacity active:opacity-70",
          verified ? "bg-success-soft text-ink" : "bg-secondary-soft text-ink",
          className,
        )}
      >
        <Icon size={14} strokeWidth={2.5} />
      </button>
      {expanded && (
        <p className="order-last basis-full text-xs font-semibold text-text-muted">
          <span className="font-extrabold uppercase text-text">{label}</span>
          {" · "}
          {description || "This vendor hasn't added a description yet."}
        </p>
      )}
    </div>
  );
}
