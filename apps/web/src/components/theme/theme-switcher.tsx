"use client";

import { THEMES, useThemeStore } from "@/lib/stores/theme-store";
import { SwatchSwitcher } from "./swatch-switcher";

const SWATCH_GRADIENTS: Record<string, string> = {
  "bold-playful": "linear-gradient(135deg, oklch(60% 0.19 325), oklch(64% 0.17 355))",
  "ocean-current": "linear-gradient(135deg, oklch(58% 0.17 235), oklch(70% 0.15 250))",
  "sunset-social": "linear-gradient(135deg, oklch(62% 0.19 35), oklch(74% 0.16 55))",
};

export function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.value);
  const setTheme = useThemeStore((s) => s.setValue);

  return (
    <SwatchSwitcher
      options={THEMES}
      value={theme}
      onChange={setTheme}
      ringClassName="h-11 w-11 rounded-full"
      renderSwatch={(id) => <span className="block h-full w-full rounded-full" style={{ background: SWATCH_GRADIENTS[id] }} />}
    />
  );
}
