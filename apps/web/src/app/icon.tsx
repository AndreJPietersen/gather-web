import { ImageResponse } from "next/og";
import { renderIconMark } from "@/lib/brand-icon-mark";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// The browser-tab favicon — see brand-icon-mark.tsx for the shared mark and
// why its colors are fixed hex. Slightly rounded, unlike the full-bleed
// apple/manifest icons below, since browsers show a tab icon as-is rather
// than masking it.
export default function Icon() {
  return new ImageResponse(renderIconMark({ size: 32, rounded: 8 }), { ...size });
}
