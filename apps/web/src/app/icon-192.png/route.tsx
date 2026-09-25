import { ImageResponse } from "next/og";
import { renderIconMark } from "@/lib/brand-icon-mark";

// A plain Route Handler, not one of Next's special icon/apple-icon file
// conventions — those don't expose a fixed, predictable URL that
// manifest.ts's icons array can reference by size, since Next manages that
// routing itself (including the generateImageMetadata multi-size path,
// whose URLs carry an internal id Next assigns). A literal ".png" segment
// name is just an ordinary route path; nothing about it is Next-specific.
// See brand-icon-mark.tsx for the shared render every icon size uses.
// 192×192 is the Web App Manifest spec's baseline "regular" icon size for
// Android home-screen/launcher entries — see icon-512.png/route.tsx for
// the larger maskable-safe size.
export async function GET() {
  return new ImageResponse(
    renderIconMark({ size: 192 }),
    { width: 192, height: 192 },
  );
}
