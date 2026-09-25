import { COLOR_TOKENS, themes, type ThemeColors, type ThemeId } from "./themes";

// oklch() -> sRGB hex, so the same theme data can drive email HTML and the
// native apps. Standard OKLab -> linear sRGB -> gamma conversion; out-of-gamut
// colours are clamped per channel.
export function oklchToHex(input: string): string {
  const m = input.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`Not an oklch() colour: ${input}`);
  const L = Number(m[1]) / 100;
  const C = Number(m[2]);
  const h = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const channel = (x: number) => {
    const c = Math.max(0, Math.min(1, x));
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(g * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${lin.map(channel).join("")}`;
}

// A whole theme as hex.
export function themeHex(id: ThemeId): ThemeColors {
  return Object.fromEntries(COLOR_TOKENS.map((t) => [t, oklchToHex(themes[id][t])])) as ThemeColors;
}
