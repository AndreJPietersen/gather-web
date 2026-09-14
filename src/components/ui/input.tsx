import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, placeholder, "aria-label": ariaLabel, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      placeholder={placeholder}
      // Placeholder text isn't reliably announced as a label by screen
      // readers, and disappears the moment someone starts typing — a real
      // WCAG 1.3.1/3.3.2 gap every form built on this component has had
      // since Phase 1. Every existing `<Input placeholder="...">` call site
      // gets this for free without needing to add an explicit aria-label
      // itself; an explicit one (or a real <label>) still wins when given.
      aria-label={ariaLabel ?? placeholder}
      className={cn(
        "w-full rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text",
        "placeholder:font-semibold placeholder:text-text-muted",
        "focus:border-primary focus:outline-none",
        "disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}
