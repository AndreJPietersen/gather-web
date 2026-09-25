"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@gather/shared/utils";
import { useMounted } from "@/lib/hooks/use-mounted";

export interface SwatchOption<T extends string> {
  id: T;
  label: string;
}

// Shared by ThemeSwitcher and PatternSwitcher, which were previously the
// same motion.button swatch grid (spring tap/hover physics, mount-guarded
// active-ring styling — see useMounted) hand-copied twice, differing only
// in each swatch's own shape/content. `ringClassName` supplies that shape
// (a plain circle for themes, a rounded square for patterns); `renderSwatch`
// supplies what's inside it.
export function SwatchSwitcher<T extends string>({
  options,
  value,
  onChange,
  ringClassName,
  renderSwatch,
  labelClassName = "text-[11px] font-bold text-text-muted",
}: {
  options: readonly SwatchOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ringClassName: string;
  renderSwatch: (id: T) => ReactNode;
  labelClassName?: string;
}) {
  const mounted = useMounted();

  return (
    <div className="flex gap-3">
      {options.map((option) => {
        const isActive = mounted && value === option.id;
        return (
          <motion.button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "relative ring-2 ring-offset-2 ring-offset-surface transition-shadow",
                ringClassName,
                isActive ? "ring-primary shadow-[0_0_0_2px_var(--color-primary)]" : "ring-transparent",
              )}
            >
              {renderSwatch(option.id)}
            </span>
            <span className={labelClassName}>{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
