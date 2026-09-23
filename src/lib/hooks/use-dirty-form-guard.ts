"use client";

import { useEffect } from "react";
import { useUnsavedChangesStore } from "@/lib/stores/unsaved-changes-store";

// Opts a form into the BackButton/tab-bar/beforeunload guards. Spread the
// returned `formProps` onto the <form> element: onChangeCapture marks dirty
// the moment any field changes (capture phase so it fires regardless of
// which nested Input/select the event actually originates on), onSubmit
// clears it — once the planner hits Save we stop guarding, same as the
// Next.js docs' own unsaved-changes example, regardless of whether the
// server action then succeeds or re-renders with a validation error.
//
// The unmount cleanup exists so a flag never survives past the page that
// set it — e.g. the user confirms "leave anyway" and lands somewhere else
// entirely; without this, that next page's own back button would find a
// stale isDirty: true left over from the form it just left.
export function useDirtyFormGuard() {
  const setDirty = useUnsavedChangesStore((state) => state.setDirty);

  useEffect(() => {
    return () => setDirty(false);
  }, [setDirty]);

  return {
    formProps: {
      onChangeCapture: () => setDirty(true),
      onSubmit: () => setDirty(false),
    },
  };
}
