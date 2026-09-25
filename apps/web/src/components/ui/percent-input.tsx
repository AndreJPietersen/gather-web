"use client";

import { useState, type ChangeEvent, type Ref } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

// Unlike CurrencyInput, this never needs a hidden-field trick: the "%" is
// shown as a visual overlay next to the field, not woven into the value
// itself (no thousands grouping either), so the input's own value stays
// plain digits the whole time — directly usable as the real form field,
// and never needing cursor-position bookkeeping, since nothing ever gets
// inserted into what the user typed.
function clampDigits(value: string, max: number): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return String(Math.min(Number(digits), max));
}

interface PercentInputProps {
  name: string;
  defaultValue?: number | string | null;
  placeholder?: string;
  className?: string;
  required?: boolean;
  max?: number;
  // Field (field.tsx) sets this to false when it already wraps this input
  // in a real <label> — see Input's own version of this prop for why.
  deriveAriaLabelFromPlaceholder?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function PercentInput({
  name,
  defaultValue,
  placeholder,
  className,
  required,
  max = 100,
  deriveAriaLabelFromPlaceholder,
  ref,
}: PercentInputProps) {
  const [value, setValue] = useState(() =>
    defaultValue !== null && defaultValue !== undefined && defaultValue !== "" ? clampDigits(String(defaultValue), max) : "",
  );

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(clampDigits(e.target.value, max));
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        name={name}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        deriveAriaLabelFromPlaceholder={deriveAriaLabelFromPlaceholder}
        className={cn("pr-8", className)}
      />
      {value && (
        <span className="pointer-events-none absolute inset-y-0 right-[13px] flex items-center text-sm font-bold text-text">
          %
        </span>
      )}
    </div>
  );
}
