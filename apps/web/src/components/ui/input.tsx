"use client";

import { type ChangeEvent, type InputHTMLAttributes, type Ref, useState } from "react";
import { cn } from "@gather/shared/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // Field (field.tsx) sets this to false when it already wraps this Input
  // in a real <label> — see the comment below for why that's necessary,
  // not just belt-and-suspenders.
  deriveAriaLabelFromPlaceholder?: boolean;
  // React 19 passes ref as a plain prop to function components — no
  // forwardRef needed — but it still has to be declared and threaded
  // through explicitly rather than swept up by `...props`.
  ref?: Ref<HTMLInputElement>;
}

// The `placeholder` attribute has no effect on these input types in any
// browser — see the overlay below.
const DATE_LIKE_TYPES = new Set(["date", "datetime-local", "time", "month", "week"]);

export function Input({
  className,
  placeholder,
  "aria-label": ariaLabel,
  deriveAriaLabelFromPlaceholder = true,
  ref,
  type,
  value,
  defaultValue,
  onChange,
  ...props
}: InputProps) {
  const isDateLike = typeof type === "string" && DATE_LIKE_TYPES.has(type);
  // Desktop Chrome fakes an empty-state hint ("mm/dd/yyyy") for date/
  // datetime-local inputs out of its own UA styling, not the `placeholder`
  // attribute — which these input types ignore everywhere. iOS Safari
  // doesn't render any such hint, so without this overlay the field just
  // looks blank until tapped.
  //
  // For a controlled input, `value` is the single source of truth — it can
  // change from outside a keystroke (e.g. event-form.tsx defaulting the end
  // date when it gains focus), and the overlay must track that. Only an
  // uncontrolled input needs its own state, updated from onChange, since
  // there's no `value` prop to read.
  const isControlled = value !== undefined;
  const [uncontrolledEmpty, setUncontrolledEmpty] = useState(() => !defaultValue);
  const isEmpty = isControlled ? !value : uncontrolledEmpty;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (isDateLike && !isControlled) setUncontrolledEmpty(!e.target.value);
    onChange?.(e);
  }

  const input = (
    <input
      ref={ref}
      type={type}
      value={value}
      defaultValue={defaultValue}
      onChange={handleChange}
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
        "w-full min-w-0 rounded-field border-2 border-border bg-surface px-[13px] py-[13px] text-sm font-bold text-text",
        "placeholder:font-semibold placeholder:text-text-muted",
        "transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft",
        "disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );

  if (!isDateLike) return input;

  // min-w-0 on both this wrapper and the input's own className above: iOS
  // Safari's native type="date"/"datetime-local" control reports an
  // unusually wide intrinsic minimum content width for its segmented
  // day/month/year display, which `width: 100%` alone doesn't override
  // inside a flex column (every form here is `flex flex-col`) — a flex
  // item's default `min-width: auto` lets that intrinsic size win and push
  // the field past its card/container edge instead of shrinking to fit.
  return (
    <div className="relative w-full min-w-0">
      {input}
      {isEmpty && (
        <span className="pointer-events-none absolute inset-y-0 left-[13px] flex items-center text-sm font-semibold text-text-muted">
          {placeholder ?? "Select a date"}
        </span>
      )}
    </div>
  );
}
