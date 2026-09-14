// Fired at exactly two success moments (RSVP confirmed, quote accepted) —
// see rsvp-form.tsx and the quote-accept action. Dynamically imports
// canvas-confetti so its payload isn't in the main bundle for routes that
// never trigger it, and reads the *currently active* theme's own colors
// (never hardcoded) so it looks right under Ocean Current/Sunset Social too.
export async function fireSuccessConfetti() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const { default: confetti } = await import("canvas-confetti");
  const styles = getComputedStyle(document.documentElement);

  const colors = [
    styles.getPropertyValue("--color-primary").trim(),
    styles.getPropertyValue("--color-secondary").trim(),
    styles.getPropertyValue("--color-success").trim(),
  ].filter(Boolean);

  confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 35,
    origin: { y: 0.7 },
    colors: colors.length > 0 ? colors : undefined,
  });
}
