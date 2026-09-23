import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge ships with hardcoded knowledge of Tailwind's *default*
// theme only — it has no way to know `rounded-pill`/`rounded-field` (this
// project's own @theme extensions in globals.css) belong to the same
// "border radius" conflict group as `rounded-[22px]`. Without this,
// cn("rounded-[22px] ...", "rounded-pill ...") — e.g. Card's base classes
// overridden by a pill-shaped LinkCard — left BOTH classes in the output
// instead of the later one winning, a real regression found in code review
// (src/app/page.tsx's vendor chips). Teaching it about the two custom radius
// values closes this for every future cn() call, not just that one call site.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: ["rounded-pill", "rounded-field"],
    },
  },
});

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

// For a plain `date` column (rsvp_date, deposit_due_date) — no time-of-day,
// so no SAST conversion either: formatted in UTC explicitly, otherwise the
// browser/server's own local timezone could roll "2027-01-15" back or
// forward a calendar day depending on where this happens to run.
export function formatEventDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
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

export interface CountdownRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

// Shared by the countdown card's server-side initial render (page.tsx,
// using the server's own Date.now() at render time) and its client-side
// setInterval tick (countdown-card.tsx, using the browser's Date.now()
// each second) — same function, different clock reading, so the two
// never drift out of sync with each other's math, only with wall-clock
// time itself between renders (expected and harmless for a live
// countdown — see countdown-card.tsx's own suppressHydrationWarning use).
export function getCountdownRemaining(targetIso: string, nowMs: number = Date.now()): CountdownRemaining {
  const diffMs = new Date(targetIso).getTime() - nowMs;
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  const seconds = Math.floor((diffMs % 60_000) / 1_000);
  return { days, hours, minutes, seconds, done: false };
}
