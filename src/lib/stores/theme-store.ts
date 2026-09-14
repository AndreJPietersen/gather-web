import { create } from "zustand";

export type ThemeName = "bold-playful" | "ocean-current" | "sunset-social";

export const THEMES: { id: ThemeName; label: string }[] = [
  { id: "bold-playful", label: "Bold Playful" },
  { id: "ocean-current", label: "Ocean Current" },
  { id: "sunset-social", label: "Sunset Social" },
];

const STORAGE_KEY = "gather-theme";
const DEFAULT_THEME: ThemeName = "bold-playful";

function isThemeName(value: string | null): value is ThemeName {
  return value === "bold-playful" || value === "ocean-current" || value === "sunset-social";
}

// Always DEFAULT_THEME on the server (and on first client render, before
// hydration) — never read localStorage here. This store is a plain
// module-level singleton, unlike persona-store.ts's per-request Context
// store: personas are session-derived data that differs per request, so a
// singleton would leak one user's data into another's SSR output. Theme is
// never derived from the session — every server render produces the same
// default for every user regardless — so a singleton has nothing
// request-specific to leak. The real per-user value only exists in the
// browser's own localStorage, applied after mount via setTheme/the inline
// script in layout.tsx (see the flash-of-wrong-theme note there).
function readInitialTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemeName(stored) ? stored : DEFAULT_THEME;
}

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readInitialTheme(),
  setTheme: (theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private browsing / storage disabled — theme still applies for this
      // page view, it just won't persist across visits.
    }
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
}));
