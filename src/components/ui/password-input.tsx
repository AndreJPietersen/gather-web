"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "./input";
import { cn } from "@/lib/utils";

// A password field with a show/hide toggle so someone can actually check
// what they typed before submitting — plain `<Input type="password">`
// gives no way to do that short of retyping it somewhere else first.
// Wraps Input rather than teaching Input itself about this, the same
// "small dedicated wrapper" pattern as Field: Input stays a plain,
// server-safe component every non-password field still uses unchanged.
export function PasswordInput({ className, ...props }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-opacity active:opacity-60"
      >
        {visible ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
      </button>
    </div>
  );
}
