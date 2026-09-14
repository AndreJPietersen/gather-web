import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "./input";

interface FieldProps {
  label: string;
  className?: string;
  children: ReactNode;
}

// A visible stacked caption + input, extracted from a pattern event-form.tsx
// hand-rolled on its own — without this, every new field either copies that
// markup again or (like the task due-date field before this) skips a visible
// label entirely, which native `type="date"`/`type="number"` inputs can't
// make up for with `placeholder` alone.
export function Field({ label, className, children }: FieldProps) {
  // When wrapping an Input specifically, tell it not to also derive its own
  // aria-label from placeholder — an aria-label attribute always beats a
  // wrapping <label> per the ARIA accname algorithm, so without this an
  // Input with both a placeholder and a Field label would announce the
  // placeholder text instead of the real label. Only Input needs this: a
  // native <select> (the other thing Field wraps, e.g. Visibility/Priority
  // fields) has no such default to suppress.
  const child =
    isValidElement(children) && children.type === Input
      ? cloneElement(children as ReactElement<InputProps>, { deriveAriaLabelFromPlaceholder: false })
      : children;

  return (
    <label className={cn("flex flex-col gap-1 text-xs font-extrabold text-text-muted", className)}>
      {label}
      {child}
    </label>
  );
}
