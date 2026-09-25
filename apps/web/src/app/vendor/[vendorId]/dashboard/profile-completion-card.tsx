import Link from "next/link";
import { getVendorCompletion, type VendorCompletionInput } from "@gather/shared/vendor-completion";

// Where each checklist item's row should link to when it isn't done yet.
// This card itself now lives at the top of the Edit page (reached from the
// dashboard's "Business Profile" tile) — logo/description are right there
// on the same page (no link needed past the anchor itself), gallery/
// services/social each moved to their own screen off the dashboard's
// launch grid, so those three now link out instead of to a same-page
// anchor the way they used to when this card lived on the old one-long-page
// dashboard.
const ITEM_HREF: Record<string, (vendorId: string) => string> = {
  logo: (vendorId) => `/vendor/${vendorId}/edit#logo`,
  description: (vendorId) => `/vendor/${vendorId}/edit#description`,
  gallery: (vendorId) => `/vendor/${vendorId}/dashboard/gallery`,
  services: (vendorId) => `/vendor/${vendorId}/dashboard/services`,
  social: (vendorId) => `/vendor/${vendorId}/dashboard/social-links`,
};

// Purely for the vendor's own motivation — this percentage is never shown
// to a planner anywhere (Home, /vendors, the public profile only ever show
// the Featured/Verified badges, not a score). See lib/vendor-completion.ts
// for why it's computed live here rather than read off a stored column.
export function ProfileCompletionCard({ vendorId, input }: { vendorId: string; input: VendorCompletionInput }) {
  const completion = getVendorCompletion(input);

  return (
    <div className="rounded-[26px] bg-surface p-5 shadow-[0_6px_16px_-8px_var(--color-ink)]">
      <p className="font-display text-[17px] font-semibold text-ink">Complete your profile</p>
      <p className="mt-1 text-xs font-semibold text-text-muted">Complete profiles rank higher on Home and in search.</p>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-pill bg-bg">
          <div
            className="h-full rounded-pill bg-[linear-gradient(90deg,var(--color-primary),var(--color-primary-glow))]"
            style={{ width: `${completion.percent}%` }}
          />
        </div>
        <span className="font-display text-[15px] font-semibold text-primary">{completion.percent}%</span>
      </div>

      <div className="mt-3 flex flex-col">
        {completion.items.map((item, index) => {
          const row = (
            <div
              className={`flex items-center gap-2.5 py-2.5 ${index < completion.items.length - 1 ? "border-b border-border" : ""}`}
            >
              {item.done ? (
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-pill bg-success">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              ) : (
                <span className="h-[22px] w-[22px] shrink-0 rounded-pill border-2 border-border bg-surface" />
              )}
              <div className="min-w-0 flex-1">
                <span className={`text-[13px] font-bold ${item.done ? "text-text-muted line-through decoration-border" : "text-text"}`}>
                  {item.label}
                </span>
                {item.detail && !item.done && (
                  <span className="block text-[11px] font-semibold text-text-muted">{item.detail}</span>
                )}
              </div>
              {!item.done && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              )}
            </div>
          );

          return item.done ? (
            <div key={item.key}>{row}</div>
          ) : (
            <Link key={item.key} href={ITEM_HREF[item.key](vendorId)}>
              {row}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
