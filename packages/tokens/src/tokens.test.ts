import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMAIL_COLORS } from "@gather/shared/email/brand";
import { oklchToHex, themeHex } from "./color";
import { COLOR_TOKENS, THEME_IDS, themes, type ThemeId } from "./themes";

const css = readFileSync(new URL("../../../apps/web/src/app/globals.css", import.meta.url), "utf8");

// The custom properties declared in one theme's block of globals.css.
function cssBlock(id: ThemeId): Record<string, string> {
  const selector = id === "bold-playful" ? ":root {" : `:root[data-theme="${id}"] {`;
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`No block for ${id} in globals.css`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(Array.from(body.matchAll(/--color-([a-z-]+):\s*([^;]+);/g), (m) => [m[1], m[2].trim()]));
}

describe("oklchToHex", () => {
  it("converts the default theme's primary and ink exactly", () => {
    expect(oklchToHex("oklch(60% 0.19 325)")).toBe("#b64ebd");
    expect(oklchToHex("oklch(22% 0.035 290)")).toBe("#1a182a");
  });
  it("clamps out-of-gamut values instead of throwing", () => {
    expect(oklchToHex("oklch(70% 0.4 30)")).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("rejects anything that isn't oklch()", () => {
    expect(() => oklchToHex("#ffffff")).toThrow();
  });
});

describe("theme data matches globals.css", () => {
  for (const id of THEME_IDS) {
    it(`${id}: every token has the same value in the CSS`, () => {
      const fromCss = cssBlock(id);
      for (const token of COLOR_TOKENS) {
        expect(fromCss[token], `${id} --color-${token}`).toBe(themes[id][token]);
      }
    });
  }
});

describe("email brand colours", () => {
  it("are the default theme's colours as hex (surface is intentionally plain white)", () => {
    const hex = themeHex("bold-playful");
    expect(EMAIL_COLORS.bg).toBe(hex.bg);
    expect(EMAIL_COLORS.ink).toBe(hex.ink);
    expect(EMAIL_COLORS.text).toBe(hex.text);
    expect(EMAIL_COLORS.muted).toBe(hex["text-muted"]);
    expect(EMAIL_COLORS.border).toBe(hex.border);
    expect(EMAIL_COLORS.primary).toBe(hex.primary);
    expect(EMAIL_COLORS.primarySoft).toBe(hex["primary-soft"]);
    expect(EMAIL_COLORS.glow).toBe(hex["primary-glow"]);
    expect(EMAIL_COLORS.secondary).toBe(hex.secondary);
    expect(EMAIL_COLORS.secondarySoft).toBe(hex["secondary-soft"]);
  });
});
