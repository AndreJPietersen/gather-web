import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
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
