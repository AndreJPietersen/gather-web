"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { THEMES, useThemeStore } from "@/lib/stores/theme-store";

const SWATCH_GRADIENTS: Record<string, string> = {
  "bold-playful": "linear-gradient(135deg, oklch(60% 0.19 325), oklch(64% 0.17 355))",
  "ocean-current": "linear-gradient(135deg, oklch(58% 0.17 235), oklch(70% 0.15 250))",
  "sunset-social": "linear-gradient(135deg, oklch(62% 0.19 35), oklch(74% 0.16 55))",
};

// The store's initial value is always the server-safe default until this
// component mounts and syncs from localStorage — reading `theme` here only
// drives this control's own selected-state UI (a one-frame, non-layout-
// affecting flash is acceptable), never any other rendered markup. See
// theme-store.ts and layout.tsx's inline script for the full reasoning.
export function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex gap-3">
      {THEMES.map((option) => {
        const isActive = mounted && theme === option.id;
        return (
          <motion.button
            key={option.id}
            type="button"
            onClick={() => setTheme(option.id)}
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "h-11 w-11 rounded-full ring-2 ring-offset-2 ring-offset-surface transition-shadow",
                isActive ? "ring-primary shadow-[0_0_0_2px_var(--color-primary)]" : "ring-transparent",
              )}
              style={{ background: SWATCH_GRADIENTS[option.id] }}
            />
            <span className="text-[11px] font-bold text-text-muted">{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
