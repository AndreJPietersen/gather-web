"use client";

import { useEffect, useRef } from "react";

// Fires `onSuccess` exactly once per real submission that resolved with no
// error — the pending:true→false transition, not "not pending" alone
// (which is also true before the first submit ever happens, and would fire
// immediately on mount if checked without the wasPending guard). Shared by
// every useActionState-driven form in this app that needs to react to its
// own successful submit (auto-advance a wizard step, close an edit toggle,
// close a modal) rather than just render an error when there is one —
// previously copy-pasted near-identically into three separate files.
export function useAdvanceOnSuccess<T extends { error?: string }>(state: T, pending: boolean, onSuccess: (state: T) => void) {
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      onSuccess(state);
    }
    wasPending.current = pending;
  }, [pending, state, onSuccess]);
}
