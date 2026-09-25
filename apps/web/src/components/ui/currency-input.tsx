"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type Ref } from "react";
import { Input } from "./input";

// Every currency field in the app is ZAR, entered as plain text (digits
// only) via a native type="number" input up to now — this replaces that
// with a masked display matching formatZAR's existing "R 1 000,00" South
// African formatting (space-grouped thousands, comma decimal), so a typed
// amount looks the same as an already-saved one shown read-only elsewhere.
//
// A `<input type="number">` can't do this: browsers reject any character
// in it that isn't a digit, a single ".", or "-" — no space, no "R", no
// comma. So this renders type="text" for display, alongside a genuinely
// hidden input carrying the plain decimal value (e.g. "1000.50") under the
// real field `name` — that's what the server action's FormData/zod
// `coerce.number()` actually reads; the visible field never is.

// Accepts "." or "," as how the planner enters the decimal point — the
// masked display shows "," (SA convention) but a phone's numeric keypad,
// and most people's typing habit, produces ".". Whichever appears first is
// treated as the decimal marker; anything after it is capped at 2 digits.
function toRawDigits(input: string): string {
  const cleaned = input.replace(/[^\d.,]/g, "");
  const sepIndex = cleaned.search(/[.,]/);
  if (sepIndex === -1) return cleaned.replace(/^0+(?=\d)/, "");
  const intPart = cleaned.slice(0, sepIndex).replace(/[.,]/g, "").replace(/^0+(?=\d)/, "");
  const decimalPart = cleaned.slice(sepIndex + 1).replace(/[.,]/g, "").slice(0, 2);
  return `${intPart}.${decimalPart}`;
}

function formatDisplay(raw: string): string {
  if (!raw) return "";
  const [intPart, decimalPart] = raw.split(".");
  const grouped = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decimalPart !== undefined ? `R ${grouped},${decimalPart}` : `R ${grouped}`;
}

function countDigitsBefore(str: string, index: number): number {
  let count = 0;
  for (let i = 0; i < index && i < str.length; i++) {
    if (/\d/.test(str[i])) count++;
  }
  return count;
}

function indexAfterNDigits(str: string, n: number): number {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str[i])) {
      count++;
      if (count === n) return i + 1;
    }
  }
  return str.length;
}

interface CurrencyInputProps {
  name: string;
  defaultValue?: number | string | null;
  required?: boolean;
  placeholder?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

function initialRaw(defaultValue: number | string | null | undefined): string {
  return defaultValue !== null && defaultValue !== undefined && defaultValue !== "" ? toRawDigits(String(defaultValue)) : "";
}

export function CurrencyInput({ name, defaultValue, required, placeholder, className, ref }: CurrencyInputProps) {
  const [raw, setRaw] = useState(() => initialRaw(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);
  // Set in the change handler (in digits-before-cursor terms, not string-
  // index terms — grouping shifts as digits are added/removed, so a fixed
  // string index from before the reformat wouldn't point at the same digit
  // after it), consumed by the layout effect right after the reformatted
  // value actually lands in the DOM.
  const pendingCursorDigits = useRef<number | null>(null);

  // Unlike a plain <input>, this field is controlled (its displayed value
  // has to be the formatted string, not the raw one) — so a native
  // form.reset() call, which several forms in this app use after a
  // successful useActionState submit to clear the form for the next entry
  // (see AddBudgetItemForm), can't reset it the normal way. Every form
  // control exposes its owning <form> via `.form`, even a hidden one, which
  // is what makes listening for the form's own "reset" event possible
  // without the caller needing a ref to this component at all.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    function handleReset() {
      setRaw(initialRaw(defaultValue));
    }
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [defaultValue]);

  useLayoutEffect(() => {
    if (pendingCursorDigits.current === null || !inputRef.current) return;
    const pos = indexAfterNDigits(formatDisplay(raw), pendingCursorDigits.current);
    inputRef.current.setSelectionRange(pos, pos);
    pendingCursorDigits.current = null;
  }, [raw]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const cursor = e.target.selectionStart ?? e.target.value.length;
    pendingCursorDigits.current = countDigitsBefore(e.target.value, cursor);
    setRaw(toRawDigits(e.target.value));
  }

  function handleBlur() {
    // Pad to 2 decimals once the planner's done, not on every keystroke —
    // forcing ".00" mid-type would make it impossible to type a value with
    // real cents (typing "1" would immediately become "1.00", so the next
    // digit would have nowhere sensible to go).
    if (!raw) return;
    const [intPart, decimalPart = ""] = raw.split(".");
    setRaw(`${intPart}.${decimalPart.padEnd(2, "0")}`);
  }

  return (
    <>
      <Input
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="text"
        inputMode="decimal"
        value={formatDisplay(raw)}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        className={className}
      />
      <input type="hidden" name={name} value={raw} />
    </>
  );
}
