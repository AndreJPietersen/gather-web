// The tent-and-rising-sun artwork from the home page hero (scalloped white
// tent, gold sun behind the peak, three bulbs on a string) — the same shapes
// as the app icon (src/lib/brand-icon-mark.tsx), drawn without the tile so it
// can sit directly on a gradient hero card. White and gold are fixed rather
// than theme tokens: the hero gradient behind it changes with the theme, but
// this reads as "white tent, warm sun" on all three (checked on Bold Playful,
// Ocean Current and Sunset Social), and --color-secondary would turn the sun
// pink on Sunset Social. Sized entirely by the caller's width/className.
export function GatherTentArt({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 30 300 228" className={`pointer-events-none ${className}`}>
      <circle cx="150" cy="92" r="57" fill="#ffd76a" />
      <g stroke="#fff" strokeWidth="11" strokeLinecap="round">
        <line x1="48" y1="166" x2="48" y2="248" />
        <line x1="252" y1="166" x2="252" y2="248" />
      </g>
      <path d="M52,180 Q150,224 248,180" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2.6" strokeLinecap="round" />
      <g fill="#ffd76a">
        <circle cx="102" cy="196" r="8.5" />
        <circle cx="150" cy="202" r="8.5" />
        <circle cx="198" cy="196" r="8.5" />
      </g>
      <path
        fill="#fff"
        d="M150,68 C142,100 96,128 34,142 Q28,146 36,150 Q64.5,196 93,150 Q121.5,196 150,150 Q178.5,196 207,150 Q235.5,196 264,150 Q272,146 266,142 C204,128 158,100 150,68 Z"
      />
    </svg>
  );
}
