import { create } from "zustand";

// The confirm() copy lives here, not at each call site, so BackButton and
// the tab bar (the two places that read isDirty to decide whether to
// interrupt navigation) show the exact same wording.
export const UNSAVED_CHANGES_MESSAGE = "You have unsaved changes. Leave anyway?";

interface UnsavedChangesState {
  isDirty: boolean;
  setDirty: (isDirty: boolean) => void;
}

// A plain global store, same reasoning as theme-store.ts: at most one form
// is ever "in progress" in this single-page-at-a-time mobile UI, and the
// flag carries no per-user server data, so a singleton has nothing
// request-specific to leak across users during SSR.
export const useUnsavedChangesStore = create<UnsavedChangesState>((set) => ({
  isDirty: false,
  setDirty: (isDirty) => set({ isDirty }),
}));

// Reads live state without subscribing — for the beforeunload handler and
// any other listener that fires outside React's render cycle, where a
// value captured by a hook could go stale.
export function isUnsavedChangesDirty(): boolean {
  return useUnsavedChangesStore.getState().isDirty;
}
