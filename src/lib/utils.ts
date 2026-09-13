import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Combines conditional class names (clsx) and resolves conflicting Tailwind
// utilities in favor of the last one wins (tailwind-merge) — e.g.
// cn("px-4", condition && "px-6") correctly ends up as just "px-6".
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
