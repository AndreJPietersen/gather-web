import { ImageResponse } from "next/og";
import { renderIconMark } from "@/lib/brand-icon-mark";

// See icon-192.png/route.tsx for why this is a plain Route Handler rather
// than one of Next's icon file conventions, and brand-icon-mark.tsx for
// the shared render every icon size uses. 512×512 is the Web App Manifest
// spec's size for a "maskable" purpose icon — large enough that
// Android/Chrome can safely crop into it for adaptive-icon shapes (circle,
// squircle, etc.) without clipping the tent, since the gradient tile itself
// fills the full canvas edge to edge.
export async function GET() {
  return new ImageResponse(
    renderIconMark({ size: 512, inset: 0.08 }),
    { width: 512, height: 512 },
  );
}
