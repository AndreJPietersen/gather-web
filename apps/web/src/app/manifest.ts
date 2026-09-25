import type { MetadataRoute } from "next";

// Powers "Add to Home Screen" on Android/Chrome — Next auto-discovers this
// file and injects the <link rel="manifest"> tag itself, the same way it
// wires up icon.tsx/apple-icon.tsx. The icons below point at the two plain
// Route Handlers in icon-192.png/ and icon-512.png/ rather than Next's
// icon.tsx convention, since a manifest needs fixed, size-labeled URLs to
// point at and that convention doesn't expose one.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gather",
    short_name: "Gather",
    description: "Plan it. Book it. Pull it off.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f0fc",
    theme_color: "#b64ebd",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
