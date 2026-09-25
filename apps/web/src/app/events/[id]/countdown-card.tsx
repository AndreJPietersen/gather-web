"use client";

import { useEffect, useState } from "react";
import { getCountdownRemaining, type CountdownRemaining } from "@/lib/utils";

// "Glass tiles on gradient" — the direction picked off the Event Countdown
// Options design canvas (a merge of two earlier sketches: a bold gradient
// hero card, and a Days/Hours/Mins/Secs segmented clock).
//
// `initial` is computed server-side in page.tsx from the *server's* clock
// at render time and used as this component's starting state verbatim —
// so the very first paint (SSR and the client's first render before
// hydration) show identical numbers, no mismatch there. The mismatch that
// *does* become unavoidable is every render after that: a countdown must
// keep advancing, so by definition anything still showing what the server
// rendered a moment ago is already stale. That's the same "expected,
// browser-only truth diverges from the server" situation the theme
// system's own blocking-script/suppressHydrationWarning pair already
// documents (teachAndre/08) — reused here for the same reason, on the
// four number spans specifically, rather than reaching for
// useSyncExternalStore (built for a value the server genuinely cannot
// know at all, like localStorage; here the server's guess is simply
// fated to go stale a second later, a milder problem).
export function CountdownCard({ targetIso, initial }: { targetIso: string; initial: CountdownRemaining }) {
  const [remaining, setRemaining] = useState(initial);

  useEffect(() => {
    // setState only ever happens inside this interval's own callback, not
    // synchronously in the effect body — the same "subscribe and react to
    // an external tick" shape chat's own reconcile() poll already uses,
    // not the set-state-in-effect pattern this project's lint forbids.
    const id = setInterval(() => {
      setRemaining(getCountdownRemaining(targetIso));
    }, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  // Self-hides once the event arrives while this card is sitting open in
  // a tab — a countdown to a moment that's already passed isn't useful,
  // and page.tsx already skips rendering this at all for an event whose
  // start_at was already in the past when the page loaded.
  if (remaining.done) {
    return null;
  }

  return (
    // Same gradient + shadow vocabulary as Button's own primary variant
    // (src/components/ui/button.tsx) — an arbitrary-value Tailwind class,
    // not an inline style prop, matching how every other static gradient
    // in this app is written.
    <div className="rounded-[26px] bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-glow))] p-5 shadow-[0_10px_24px_-8px_var(--color-primary)]">
      <div className="grid grid-cols-4 gap-2">
        <CountdownTile value={remaining.days} label="Days" />
        <CountdownTile value={remaining.hours} label="Hours" />
        <CountdownTile value={remaining.minutes} label="Mins" />
        <CountdownTile value={remaining.seconds} label="Secs" />
      </div>
    </div>
  );
}

function CountdownTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-[14px] border border-white/30 bg-white/15 px-1 py-3">
      <span className="font-display text-2xl font-bold text-white" suppressHydrationWarning>
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[9px] font-extrabold uppercase tracking-wide text-white/85">{label}</span>
    </div>
  );
}
