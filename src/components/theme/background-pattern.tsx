// Always renders the same markup on server and client — which pattern (if
// any) actually shows is decided purely by CSS, via [data-bg-pattern] rules
// in globals.css keyed off the same attribute pattern-store.ts sets on
// <html>. This mirrors [data-theme]'s own rule (see layout.tsx and
// theme-store.ts): background pattern must never branch rendered JSX, only
// CSS, so switching it can never trigger a hydration mismatch.
//
// Mounted once per shell branch in app-shell.tsx, fixed behind everything —
// body's own bg-bg paints first, this paints over it, then the real page
// content (cards, etc.) paints over this.
export function BackgroundPattern() {
  return (
    <svg
      aria-hidden
      className="bg-pattern-svg pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: -1 }}
    >
      <defs>
        <linearGradient id="pattern-confetti-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-primary-glow)" />
        </linearGradient>

        {/* Category Confetti — a tiny calendar chip, ring, checkmark and
            coin scattered at deliberately unaligned positions/rotations so
            the 200x200 repeat doesn't read as a grid. */}
        <pattern id="pattern-category-confetti" width="200" height="200" patternUnits="userSpaceOnUse">
          <g style={{ fill: "var(--color-primary)", stroke: "var(--color-primary)" }} opacity="0.24">
            <g transform="translate(24,30) rotate(10)">
              <rect x="-4" y="-4" width="8" height="8" rx="2" fill="none" strokeWidth="1.3" />
              <line x1="-2" y1="-6" x2="-2" y2="-3" strokeWidth="1.3" />
              <line x1="2" y1="-6" x2="2" y2="-3" strokeWidth="1.3" />
            </g>
            <g transform="translate(172,158) rotate(-25) scale(0.85)">
              <rect x="-4" y="-4" width="8" height="8" rx="2" fill="none" strokeWidth="1.3" />
              <line x1="-2" y1="-6" x2="-2" y2="-3" strokeWidth="1.3" />
              <line x1="2" y1="-6" x2="2" y2="-3" strokeWidth="1.3" />
            </g>
            <g transform="translate(58,98) rotate(-16) scale(1.1)">
              <rect x="-4" y="-4" width="8" height="8" rx="2" fill="none" strokeWidth="1.3" />
              <line x1="-2" y1="-6" x2="-2" y2="-3" strokeWidth="1.3" />
              <line x1="2" y1="-6" x2="2" y2="-3" strokeWidth="1.3" />
            </g>
          </g>

          <g style={{ stroke: "var(--color-secondary)" }} opacity="0.4" fill="none">
            <circle cx="151" cy="20" r="3.6" strokeWidth="1.3" />
            <circle cx="14" cy="132" r="3" strokeWidth="1.3" />
            <circle cx="118" cy="182" r="4" strokeWidth="1.3" />
          </g>

          <g style={{ stroke: "var(--color-success)" }} opacity="0.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M75,52 L78,55.5 L84,47.5" strokeWidth="1.4" transform="rotate(-14 79 51)" />
            <path d="M75,52 L78,55.5 L84,47.5" strokeWidth="1.4" transform="translate(52,68) rotate(18)" />
            <path d="M75,52 L78,55.5 L84,47.5" strokeWidth="1.4" transform="translate(-42,116) rotate(-8) scale(0.9)" />
          </g>

          <g style={{ fill: "var(--color-primary-glow)" }} opacity="0.22">
            <circle cx="186" cy="70" r="2.8" />
            <circle cx="92" cy="164" r="2.4" />
            <circle cx="36" cy="12" r="2.6" />
          </g>
        </pattern>

        {/* Gradient Confetti — the original assorted-shape scatter, every
            piece pulling from one primary→glow gradient instead of mixing
            in secondary/success. */}
        <pattern id="pattern-gradient-confetti" width="90" height="90" patternUnits="userSpaceOnUse">
          <g fill="url(#pattern-confetti-gradient)">
            <circle cx="10" cy="14" r="2.4" opacity="0.18" />
            <rect x="55" y="8" width="6" height="3" rx="1" opacity="0.2" transform="rotate(28 58 9.5)" />
            <circle cx="72" cy="46" r="2" opacity="0.16" />
            <rect x="22" y="55" width="5" height="3" rx="1" opacity="0.18" transform="rotate(-18 24 56)" />
            <circle cx="45" cy="78" r="2.2" opacity="0.14" />
            <rect x="80" y="70" width="5" height="3" rx="1" opacity="0.2" transform="rotate(12 82 71)" />
          </g>
        </pattern>

        {/* Corner Burst — the same assorted shapes as the original pick,
            full brightness; [data-bg-pattern="corner-burst"] in globals.css
            fades it out toward the center with mask-image so the middle of
            the screen (where content sits) stays clear. */}
        <pattern id="pattern-corner-burst" width="90" height="90" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="14" r="2.4" style={{ fill: "var(--color-primary)" }} opacity="0.2" />
          <rect x="55" y="8" width="6" height="3" rx="1" style={{ fill: "var(--color-secondary)" }} opacity="0.55" transform="rotate(28 58 9.5)" />
          <circle cx="72" cy="46" r="2" style={{ fill: "var(--color-success)" }} opacity="0.4" />
          <rect x="22" y="55" width="5" height="3" rx="1" style={{ fill: "var(--color-primary-glow)" }} opacity="0.45" transform="rotate(-18 24 56)" />
          <circle cx="45" cy="78" r="2.2" style={{ fill: "var(--color-primary)" }} opacity="0.18" />
          <rect x="80" y="70" width="5" height="3" rx="1" style={{ fill: "var(--color-secondary)" }} opacity="0.5" transform="rotate(12 82 71)" />
        </pattern>
      </defs>
      <rect className="bg-pattern-fill" width="100%" height="100%" />
    </svg>
  );
}
