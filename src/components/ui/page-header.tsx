import type { ReactNode } from "react";
import { BackButton } from "./back-button";

// Every drill-down page used to stack Back, the title, any status badges,
// and a subtitle as four separate flush-left lines before any real content
// started — the "cluttered header" Andre flagged. Back now sits beside the
// title as its own circular control instead of owning a line, and whatever
// used to follow the title (badges, subtitle, stat lines) nests one level
// in — indented under the title rather than stacked flush with it — so the
// title reads as the one thing on its own row, and everything else reads as
// detail about it, not four peers of equal weight.
export function PageHeader({
  title,
  action,
  children,
}: {
  title: ReactNode;
  // A control that belongs beside the title itself (e.g. a "Confirmed" /
  // "Pending" toggle) — distinct from `children`, which renders indented
  // below the title/back row, not on it.
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="flex-1 font-display text-3xl font-semibold leading-[1.15] text-ink">{title}</h1>
        {action}
      </div>
      {children && <div className="ml-14 flex flex-col gap-2">{children}</div>}
    </div>
  );
}
