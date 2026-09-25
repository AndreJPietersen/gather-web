import { create } from "zustand";

// Shared by theme-store.ts and pattern-store.ts, which were previously the
// same store shape hand-copied twice: a guarded initial read (server/
// pre-hydration always gets `defaultValue`, never localStorage), a
// validator against a fixed set of values, and a write path that persists
// to localStorage (best-effort, private-browsing-safe) and sets an
// attribute on <html> so pure-CSS `[data-*]` selectors can react to it —
// see layout.tsx's inline anti-flash script and globals.css's [data-theme]/
// [data-bg-pattern] rules for why that attribute, not React, is what's
// allowed to actually change what renders.
export function createPersistedAttributeStore<T extends string>({
  storageKey,
  htmlAttribute,
  values,
  defaultValue,
}: {
  storageKey: string;
  htmlAttribute: string;
  values: readonly T[];
  defaultValue: T;
}) {
  function isValidValue(value: string | null): value is T {
    return (values as readonly string[]).includes(value ?? "");
  }

  function readInitial(): T {
    if (typeof window === "undefined") return defaultValue;
    const stored = window.localStorage.getItem(storageKey);
    return isValidValue(stored) ? stored : defaultValue;
  }

  interface State {
    value: T;
    setValue: (value: T) => void;
  }

  return create<State>((set) => ({
    value: readInitial(),
    setValue: (value) => {
      try {
        window.localStorage.setItem(storageKey, value);
      } catch {
        // Private browsing / storage disabled — value still applies for
        // this page view, it just won't persist across visits.
      }
      document.documentElement.setAttribute(htmlAttribute, value);
      set({ value });
    },
  }));
}
