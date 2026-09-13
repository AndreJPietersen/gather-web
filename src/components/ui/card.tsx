import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Card radius is deliberately not a shared token — the prototype uses
// different radii by context (18px list rows, 22-26px feature cards, 36px
// hero blocks). This default (22px) matches the most common case; override
// per use with className, e.g. <Card className="rounded-[26px]">.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[22px] bg-surface p-4", className)} {...props} />;
}
