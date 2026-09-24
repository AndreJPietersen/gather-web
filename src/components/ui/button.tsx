"use client";

import { type ButtonHTMLAttributes } from "react";
import Link, { type LinkProps } from "next/link";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

// "primary" (gradient + shimmer) is reserved for genuinely grandiose
// moments — log in, register, the guest landing hero's CTAs — not every
// action that happens to be the important one on its screen. "accent" is
// the same gradient/shadow treatment for everything else that still
// deserves the theme's color (a wizard's Next, Mark Paid, a confirm
// dialog's confirm button) without implying the same kind of occasion.
export type ButtonVariant = "primary" | "accent" | "secondary";

const MotionLink = motion.create(Link);

// Spring, not a CSS transition: a spring can be interrupted and reversed
// mid-bounce (tap-release-tap in quick succession settles naturally), which
// a fixed-duration CSS transition can't do without visibly snapping.
const pressTransition = { type: "spring" as const, stiffness: 500, damping: 30 };
const pressMotionProps = {
  whileTap: { scale: 0.94 },
  whileHover: { scale: 1.02 },
  transition: pressTransition,
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "relative overflow-hidden bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-glow))] text-white shadow-[0_8px_18px_-6px_var(--color-primary)] hover:shadow-[0_10px_24px_-6px_var(--color-primary)]",
  accent:
    "bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-glow))] text-white shadow-[0_8px_18px_-6px_var(--color-primary)] hover:shadow-[0_10px_24px_-6px_var(--color-primary)]",
  secondary: "bg-surface text-text border-2 border-border hover:bg-primary-soft",
};

function buttonClasses(variant: ButtonVariant, className?: string) {
  return cn(
    "rounded-pill px-6 py-3.5 text-[14.5px] font-extrabold transition-shadow disabled:opacity-50 disabled:pointer-events-none inline-block text-center",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    variantClasses[variant],
    className,
  );
}

// The diagonal light-sweep on the primary variant only — a shimmer loop is
// cheap on a small element like a button but wasteful (and gated off under
// prefers-reduced-motion via globals.css) on large gradient areas.
function ButtonShimmer() {
  return (
    <span
      aria-hidden
      className="animate-shimmer pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,oklch(100%_0_0/0.35)_50%,transparent_65%)] bg-[length:250%_100%]"
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <motion.button
      className={buttonClasses(variant, className)}
      {...pressMotionProps}
      {...(props as HTMLMotionProps<"button">)}
    >
      {children}
      {variant === "primary" && <ButtonShimmer />}
    </motion.button>
  );
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
export function LinkButton({ variant = "primary", className, children, ...props }: LinkButtonProps) {
  return (
    <MotionLink className={buttonClasses(variant, className)} {...pressMotionProps} {...props}>
      {children}
      {variant === "primary" && <ButtonShimmer />}
    </MotionLink>
  );
}
