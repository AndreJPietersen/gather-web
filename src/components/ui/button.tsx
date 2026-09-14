import { type ButtonHTMLAttributes } from "react";
import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white shadow-[0_8px_18px_-6px_var(--color-primary)]",
  secondary: "bg-surface text-text border-2 border-border",
};

function buttonClasses(variant: ButtonVariant, className?: string) {
  return cn(
    "rounded-pill px-6 py-3.5 text-[14.5px] font-extrabold transition-opacity active:opacity-80 disabled:opacity-50 disabled:pointer-events-none inline-block text-center",
    // No focus indicator existed at all before this — every button and
    // LinkButton in the app was genuinely untabbable-to-with-confidence via
    // keyboard, since :focus-visible had no visible styling to distinguish
    // it from an unfocused element.
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    variantClasses[variant],
    className,
  );
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  className?: string;
  children?: React.ReactNode;
}

// A navigation styled like a Button, rendered as a real <a> — nesting a
// <button> inside a <Link>'s anchor is invalid HTML, so any CTA that
// navigates (rather than submits/triggers an action) should use this
// instead of wrapping <Button> in <Link>.
export function LinkButton({ variant = "primary", className, ...props }: LinkButtonProps) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}
