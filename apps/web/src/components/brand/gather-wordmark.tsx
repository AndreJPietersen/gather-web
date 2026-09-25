// The "Gather" wordmark — the whole word in Dancing Script (font-script, see
// layout.tsx), white, for the two gradient hero cards it lives on (guest and
// signed-in — see src/app/page.tsx and src/components/landing/guest-landing.tsx).
// This is the cursive Andre asked to keep after the earlier rounds; it replaced
// a Fredoka wordmark with a colored G and confetti overlay. The tent-and-sun
// artwork that goes with it lives in gather-tent-art.tsx, and the app-icon
// version of the same mark in src/lib/brand-icon-mark.tsx.
// Callers should only pass sizing (e.g. "text-[40px]").
export function GatherWordmark({ className = "" }: { className?: string }) {
  return <span className={`inline-block whitespace-nowrap font-script font-bold leading-none text-white ${className}`}>Gather</span>;
}
