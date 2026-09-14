import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Combines conditional class names (clsx) and resolves conflicting Tailwind
// utilities in favor of the last one wins (tailwind-merge) — e.g.
// cn("px-4", condition && "px-6") correctly ends up as just "px-6".
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// South Africa-only for launch (see docs/gather_web_architecture.md's
// Product Design Principles) — hardcoded locale/timezone, not a user choice.
// Revisit alongside the ZAR-only currency formatting when that changes.
export function formatEventDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  });
}

// SAST is a fixed UTC+2 offset with no daylight saving, so appending it
// directly to a `datetime-local` input's value (which has no timezone of
// its own) is enough to correctly convert a SAST wall-clock time to the
// real UTC instant stored in Postgres — no timezone library needed for a
// single-region, no-DST launch market.
export function sastInputToIso(value: string): string {
  return new Date(`${value}:00+02:00`).toISOString();
}

// The inverse, for pre-filling a `datetime-local` input from a stored UTC
// timestamp — formats the parts in Africa/Johannesburg specifically rather
// than the server process's own timezone, which would silently be wrong
// for anyone running this outside SAST.
export function isoToSastInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Real Intl.NumberFormat currency formatting, not bare `R{amount}` string
// concatenation — the Salesforce build rendered money that way everywhere
// and it was flagged as a real gap to close "this time" (see
// docs/gather_web_epic_roadmap.md's Outstanding Items). ZAR-only per the
// South-Africa-only launch principle; `amount` comes in as a numeric
// column's string representation via postgres.js, not a JS number.
export function formatZAR(amount: string | number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(amount));
}
