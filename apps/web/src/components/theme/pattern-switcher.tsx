"use client";

import { PATTERNS, usePatternStore } from "@/lib/stores/pattern-store";
import { SwatchSwitcher } from "./swatch-switcher";

export function PatternSwitcher() {
  const pattern = usePatternStore((s) => s.value);
  const setPattern = usePatternStore((s) => s.setValue);

  return (
    <SwatchSwitcher
      options={PATTERNS}
      value={pattern}
      onChange={setPattern}
      ringClassName="h-11 w-11 overflow-hidden rounded-[13px] border border-border bg-surface"
      renderSwatch={(id) => <PatternSwatch id={id} />}
      labelClassName="text-[10.5px] font-bold leading-tight text-text-muted"
    />
  );
}

function PatternSwatch({ id }: { id: (typeof PATTERNS)[number]["id"] }) {
  if (id === "none") {
    return <span className="absolute inset-0 rounded-[13px] border border-dashed border-border" />;
  }

  if (id === "category-confetti") {
    return (
      <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full">
        <g transform="translate(10,12) rotate(10)" style={{ stroke: "var(--color-primary)" }} fill="none" opacity="0.85">
          <rect x="-3.5" y="-3.5" width="7" height="7" rx="1.6" strokeWidth="1.3" />
          <line x1="-1.7" y1="-5.2" x2="-1.7" y2="-2.8" strokeWidth="1.3" />
          <line x1="1.7" y1="-5.2" x2="1.7" y2="-2.8" strokeWidth="1.3" />
        </g>
        <circle cx="33" cy="10" r="3" style={{ stroke: "var(--color-secondary)" }} fill="none" strokeWidth="1.3" opacity="0.9" />
        <path
          d="M14,30 L16.6,32.8 L21.5,26.5"
          style={{ stroke: "var(--color-success)" }}
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />
        <circle cx="34" cy="33" r="2.8" style={{ fill: "var(--color-primary-glow)" }} opacity="0.7" />
      </svg>
    );
  }

  if (id === "gradient-confetti") {
    return (
      <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="swatch-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-primary-glow)" />
          </linearGradient>
        </defs>
        <g fill="url(#swatch-grad)">
          <circle cx="9" cy="11" r="2.6" opacity="0.9" />
          <rect x="27" y="6" width="7" height="3.4" rx="1" opacity="0.9" transform="rotate(24 30.5 7.7)" />
          <circle cx="33" cy="24" r="2.2" opacity="0.75" />
          <rect x="10" y="27" width="6" height="3" rx="1" opacity="0.8" transform="rotate(-16 13 28.5)" />
          <circle cx="22" cy="35" r="2.4" opacity="0.7" />
        </g>
      </svg>
    );
  }

  // corner-burst
  return (
    <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full">
      <defs>
        <radialGradient id="swatch-burst-mask" cx="50%" cy="50%" r="65%">
          <stop offset="20%" stopColor="white" stopOpacity="0" />
          <stop offset="90%" stopColor="white" stopOpacity="1" />
        </radialGradient>
        <mask id="swatch-burst-mask-apply">
          <rect width="44" height="44" fill="url(#swatch-burst-mask)" />
        </mask>
      </defs>
      <g mask="url(#swatch-burst-mask-apply)">
        <circle cx="6" cy="8" r="2.6" style={{ fill: "var(--color-primary)" }} opacity="0.9" />
        <rect x="30" y="4" width="7" height="3.4" rx="1" style={{ fill: "var(--color-secondary)" }} opacity="0.95" transform="rotate(24 33.5 5.7)" />
        <circle cx="38" cy="22" r="2.2" style={{ fill: "var(--color-success)" }} opacity="0.85" />
        <rect x="4" y="30" width="6" height="3" rx="1" style={{ fill: "var(--color-primary-glow)" }} opacity="0.9" transform="rotate(-16 7 31.5)" />
        <circle cx="34" cy="38" r="2.4" style={{ fill: "var(--color-primary)" }} opacity="0.85" />
        <circle cx="12" cy="40" r="2" style={{ fill: "var(--color-secondary)" }} opacity="0.8" />
      </g>
    </svg>
  );
}
