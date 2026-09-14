import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // Field (field.tsx) sets this to false when it already wraps this Input
  // in a real <label> — see the comment below for why that's necessary,
  // not just belt-and-suspenders.
  deriveAriaLabelFromPlaceholder?: boolean;
}

export function Input({
  className,
  placeholder,
  "aria-label": ariaLabel,
  deriveAriaLabelFromPlaceholder = true,
  ...props
}: InputProps) {
  return (
    <input
      placeholder={placeholder}
      // Placeholder text isn't reliably announced as a label by screen
      // readers, and disappears the moment someone starts typing — a real
      // WCAG 1.3.1/3.3.2 gap every form built on this component has had
      // since Phase 1. Every existing `<Input placeholder="...">` call site
      // gets this for free without needing to add an explicit aria-label
      // itself.
      //
      // deriveAriaLabelFromPlaceholder must be checked, not just an explicit
      // `ariaLabel` prop: per the ARIA accname algorithm, an aria-label
      // attribute always wins over a wrapping <label> element, regardless
      // of which one a developer "meant" to be authoritative. Field wraps
      // this Input in a real <label>, so unconditionally defaulting
      // aria-label from placeholder here would silently override Field's
      // real label with the (often just a hint, e.g. "planner@example.com")
      // placeholder text — a real regression found in code review, not
      // hypothetical, once Field started being combined with a placeholder.
      aria-label={ariaLabel ?? (deriveAriaLabelFromPlaceholder ? placeholder : undefined)}
      className={cn(
        "w-full rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text",
        "placeholder:font-semibold placeholder:text-text-muted",
        "transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft",
        "disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}
