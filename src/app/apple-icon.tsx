import { ImageResponse } from "next/og";
import { renderIconMark } from "@/lib/brand-icon-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The iOS home-screen icon — see brand-icon-mark.tsx for the shared mark.
// Deliberately full-bleed with no border-radius: iOS applies its own
// rounded-square mask over whatever image is submitted, so a version
// pre-rounded here would get double-rounded on the actual home screen —
// Apple's guidance is to always submit a plain square.
export default function AppleIcon() {
  return new ImageResponse(renderIconMark({ size: 180 }), { ...size });
}
