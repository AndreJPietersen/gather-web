"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { UNSAVED_CHANGES_MESSAGE, useUnsavedChangesStore } from "@/lib/stores/unsaved-changes-store";
import { confirmDialog } from "@/lib/stores/confirm-dialog-store";

// Every drill-down page (anything reached by tapping into a list, not one of
// the 4 tab-bar roots) gets one of these — before this, the only way back
// was the browser/OS back gesture, with zero in-app affordance, which read
// as "not a native app" on a real phone. router.back() rather than a fixed
// href: it returns to wherever the user actually came from (a filtered
// vendor search, a specific tab), which a hardcoded parent link can't do.
//
// A circular icon-only tap target, not a text "< Back" link — it used to sit
// on its own line above the title, competing with it as a fourth stacked
// line of similar-weight text. Rendered inline beside the title by
// PageHeader now, it reads as a control (like a real back chevron), not
// another line of copy. Sized at the 44px floor for a real tap target.
//
// Since PageHeader puts this on every drill-down page, it's also the single
// choke point for the unsaved-changes guard (useDirtyFormGuard) — no
// per-page wiring needed for "tap Back off a dirty form" specifically. It
// does NOT cover the phone's own OS/hardware back gesture, which bypasses
// this onClick entirely and goes straight through the browser's history API.
export function BackButton() {
  const router = useRouter();
  const isDirty = useUnsavedChangesStore((state) => state.isDirty);
  const setDirty = useUnsavedChangesStore((state) => state.setDirty);

  async function handleClick() {
    if (isDirty && !(await confirmDialog({ message: UNSAVED_CHANGES_MESSAGE }))) return;
    setDirty(false);
    router.back();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Go back"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border-2 border-border bg-surface text-text shadow-[0_4px_10px_-6px_var(--color-ink)] transition-opacity active:opacity-60"
    >
      <ChevronLeft size={20} strokeWidth={2.5} />
    </button>
  );
}
