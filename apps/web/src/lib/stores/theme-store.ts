import { createPersistedAttributeStore } from "./create-persisted-attribute-store";

export type ThemeName = "bold-playful" | "ocean-current" | "sunset-social";

export const THEMES: { id: ThemeName; label: string }[] = [
  { id: "bold-playful", label: "Bold Playful" },
  { id: "ocean-current", label: "Ocean Current" },
  { id: "sunset-social", label: "Sunset Social" },
];

// A per-device preference, never server/session-derived — see
// create-persisted-attribute-store.ts for why that makes a plain
// module-level singleton safe here, unlike persona-store.ts's per-request
// Context store.
export const useThemeStore = createPersistedAttributeStore<ThemeName>({
  storageKey: "gather-theme",
  htmlAttribute: "data-theme",
  values: ["bold-playful", "ocean-current", "sunset-social"],
  defaultValue: "bold-playful",
});
