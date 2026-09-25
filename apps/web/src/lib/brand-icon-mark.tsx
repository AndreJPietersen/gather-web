// The Gather app icon: a scalloped white tent with a gold sun rising behind
// the peak and three bulbs on a string, on Bold Playful's primary→glow
// gradient. Shared by icon.tsx (favicon), apple-icon.tsx, and the two
// manifest-icon Route Handlers (icon-192.png, icon-512.png). The same shapes
// as the hero artwork (src/components/brand/gather-tent-art.tsx), drawn here
// as one inline SVG because these routes render through Satori/Resvg, not a
// browser.
//
// Colors are fixed hex (resolved from --color-primary/--color-primary-glow via
// a browser's own oklch→rgb conversion, not hand-guessed) rather than CSS
// custom properties: there is no page, no [data-theme] attribute, and no
// in-app theme preference to read here, so every viewer gets the same icon
// whichever of the three themes they picked inside the app. No text in the
// mark, so no font is loaded for these routes.
export const GRADIENT = "linear-gradient(135deg, #b64ebd, #d85891)";

// inset (a fraction of the canvas, per side) shrinks the mark toward the center
// so a maskable icon keeps it inside the safe zone Android crops to.
export function renderIconMark({ size, rounded, inset = 0 }: { size: number; rounded?: number; inset?: number }) {
  const markSize = Math.round(size * (1 - inset * 2));
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: GRADIENT,
        borderRadius: rounded ?? 0,
      }}
    >
      <svg width={markSize} height={markSize} viewBox="0 0 300 300">
        <circle cx="150" cy="92" r="57" fill="#ffd76a" />
        <line x1="48" y1="166" x2="48" y2="248" stroke="#fff" stroke-width="11" stroke-linecap="round" />
        <line x1="252" y1="166" x2="252" y2="248" stroke="#fff" stroke-width="11" stroke-linecap="round" />
        <path d="M52,180 Q150,224 248,180" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="2.6" stroke-linecap="round" />
        <circle cx="102" cy="196" r="8.5" fill="#ffd76a" />
        <circle cx="150" cy="202" r="8.5" fill="#ffd76a" />
        <circle cx="198" cy="196" r="8.5" fill="#ffd76a" />
        <path
          fill="#fff"
          d="M150,68 C142,100 96,128 34,142 Q28,146 36,150 Q64.5,196 93,150 Q121.5,196 150,150 Q178.5,196 207,150 Q235.5,196 264,150 Q272,146 266,142 C204,128 158,100 150,68 Z"
        />
      </svg>
    </div>
  );
}
