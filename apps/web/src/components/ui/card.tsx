// motion.create() itself (not just rendering a motion component) executes
// client-only code at module-evaluation time, so this whole file needs
// "use client" — even though Card itself renders a plain <div>, it shares a
// module with LinkCard's MotionLink factory call below.
"use client";

import { type HTMLAttributes } from "react";
import Link, { type LinkProps } from "next/link";
import { motion } from "motion/react";
import { cn } from "@gather/shared/utils";

const MotionLink = motion.create(Link);

// Card radius is deliberately not a shared token — the prototype uses
// different radii by context (18px list rows, 22-26px feature cards, 36px
// hero blocks). This default (22px) matches the most common case; override
// per use with className, e.g. <Card className="rounded-[26px]">.
const cardBaseClasses =
  "rounded-[22px] bg-surface p-4 shadow-[0_6px_16px_-8px_var(--color-ink)] transition-shadow";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardBaseClasses, className)} {...props} />;
}

interface LinkCardProps extends LinkProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

// A Card that navigates — replaces the previous <Link><Card>...</Card></Link>
// nesting pattern with one primitive that also gets real press/hover
// feedback.
export function LinkCard({ className, children, ...props }: LinkCardProps) {
  return (
    <MotionLink
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2, boxShadow: "0 10px 22px -8px var(--color-ink)" }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(cardBaseClasses, "block", className)}
      {...props}
    >
      {children}
    </MotionLink>
  );
}
