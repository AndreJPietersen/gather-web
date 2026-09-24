import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

// A store backed by localStorage (theme-store.ts, pattern-store.ts) always
// starts at its server-safe default until the client mounts and syncs the
// real value — reading the live value before that only drives a control's
// own "which one is selected" UI (a one-frame, non-layout-affecting flash
// is acceptable there), never anything else rendered. Used by
// SwatchSwitcher so an active-swatch ring doesn't render as "selected"
// from the default before the real client value is known.
//
// useSyncExternalStore, not useEffect + setState — the same fix teachAndre
// file 12 already documents for exactly this shape of problem (a value
// that's legitimately different between the server's render and the
// client's first real read). getServerSnapshot returns false so SSR and
// the initial hydration pass agree; getSnapshot returns true for every
// client render after that. There's nothing to actually subscribe to
// (this never changes again once true), so subscribe is a no-op.
export function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
