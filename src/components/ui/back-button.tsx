"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

// Every drill-down page (anything reached by tapping into a list, not one of
// the 4 tab-bar roots) gets one of these — before this, the only way back
// was the browser/OS back gesture, with zero in-app affordance, which read
// as "not a native app" on a real phone. router.back() rather than a fixed
// href: it returns to wherever the user actually came from (a filtered
// vendor search, a specific tab), which a hardcoded parent link can't do.
export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Go back"
      className="flex w-fit items-center gap-1 text-sm font-extrabold text-text-muted transition-opacity active:opacity-60"
    >
      <ChevronLeft size={18} strokeWidth={2.5} />
      Back
    </button>
  );
}
