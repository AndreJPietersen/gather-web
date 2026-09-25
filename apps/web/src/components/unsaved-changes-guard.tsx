"use client";

import { useEffect } from "react";
import { isUnsavedChangesDirty } from "@/lib/stores/unsaved-changes-store";

// Catches the exits in-app navigation can't: closing the tab, refreshing, or
// typing a new URL/hitting a bookmark. Browsers ignore any custom message
// here and show their own generic wording, so this only needs to decide
// whether to prompt at all.
export function UnsavedChangesGuard() {
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isUnsavedChangesDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return null;
}
