// Gather's three colour themes as data. The website's CSS
// (apps/web/src/app/globals.css) declares the same values as custom
// properties; a test (tokens.test.ts) fails if the two ever differ, so
// change both together. The values are oklch() strings because that's what
// the CSS uses; color.ts converts them to hex for places that can't read
// oklch — email clients and the native apps.

export const THEME_IDS = ["bold-playful", "ocean-current", "sunset-social"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "bold-playful";

export const THEME_LABELS: Record<ThemeId, string> = {
  "bold-playful": "Bold Playful",
  "ocean-current": "Ocean Current",
  "sunset-social": "Sunset Social",
};

export const COLOR_TOKENS = [
  "bg",
  "surface",
  "ink",
  "text",
  "text-muted",
  "border",
  "primary",
  "primary-soft",
  "primary-glow",
  "secondary",
  "secondary-soft",
  "success",
  "success-soft",
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

export type ThemeColors = Record<ColorToken, string>;

export const themes: Record<ThemeId, ThemeColors> = {
  "bold-playful": {
    bg: "oklch(96% 0.015 290)",
    surface: "oklch(99% 0.006 290)",
    ink: "oklch(22% 0.035 290)",
    text: "oklch(24% 0.03 290)",
    "text-muted": "oklch(54% 0.02 290)",
    border: "oklch(90% 0.02 290)",
    primary: "oklch(60% 0.19 325)",
    "primary-soft": "oklch(91% 0.05 325)",
    "primary-glow": "oklch(64% 0.17 355)",
    secondary: "oklch(80% 0.16 90)",
    "secondary-soft": "oklch(93% 0.06 90)",
    success: "oklch(72% 0.15 150)",
    "success-soft": "oklch(92% 0.05 150)",
  },
  "ocean-current": {
    bg: "oklch(96% 0.012 230)",
    surface: "oklch(99% 0.005 230)",
    ink: "oklch(21% 0.03 240)",
    text: "oklch(23% 0.028 240)",
    "text-muted": "oklch(53% 0.02 235)",
    border: "oklch(89% 0.02 230)",
    primary: "oklch(58% 0.17 235)",
    "primary-soft": "oklch(91% 0.05 235)",
    "primary-glow": "oklch(70% 0.15 250)",
    secondary: "oklch(78% 0.15 55)",
    "secondary-soft": "oklch(93% 0.06 55)",
    success: "oklch(72% 0.14 165)",
    "success-soft": "oklch(92% 0.05 165)",
  },
  "sunset-social": {
    bg: "oklch(96% 0.016 40)",
    surface: "oklch(99% 0.007 40)",
    ink: "oklch(23% 0.035 30)",
    text: "oklch(25% 0.032 30)",
    "text-muted": "oklch(54% 0.022 35)",
    border: "oklch(90% 0.022 40)",
    primary: "oklch(62% 0.19 35)",
    "primary-soft": "oklch(91% 0.06 35)",
    "primary-glow": "oklch(74% 0.16 55)",
    secondary: "oklch(72% 0.17 350)",
    "secondary-soft": "oklch(92% 0.06 350)",
    success: "oklch(74% 0.15 145)",
    "success-soft": "oklch(92% 0.05 145)",
  },
};

// Shape tokens (px) and the font families the app loads (next/font on web;
// expo-font on native).
export const radius = { pill: 999, field: 16 } as const;
export const fonts = { display: "Fredoka", body: "Nunito", script: "Dancing Script" } as const;
