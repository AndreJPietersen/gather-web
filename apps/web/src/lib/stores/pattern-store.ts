import { createPersistedAttributeStore } from "./create-persisted-attribute-store";

export type PatternName = "none" | "category-confetti" | "gradient-confetti" | "corner-burst";

export const PATTERNS: { id: PatternName; label: string }[] = [
  { id: "none", label: "None" },
  { id: "category-confetti", label: "Category Confetti" },
  { id: "gradient-confetti", label: "Gradient Confetti" },
  { id: "corner-burst", label: "Corner Burst" },
];

// Andre's call: new/existing users with no stored preference get Category
// Confetti rather than a blank background — "None" is still one tap away
// on Profile for anyone who wants the plain look back. The pattern itself
// never branches rendered JSX — BackgroundPattern (background-pattern.tsx)
// always renders the same SVG, and [data-bg-pattern] in globals.css is
// what actually shows or hides each one, exactly like [data-theme] does
// for colors.
export const usePatternStore = createPersistedAttributeStore<PatternName>({
  storageKey: "gather-bg-pattern",
  htmlAttribute: "data-bg-pattern",
  values: ["none", "category-confetti", "gradient-confetti", "corner-burst"],
  defaultValue: "category-confetti",
});
