// Gather's brand, restated for email. Email clients support a small, old
// subset of CSS — no custom properties, no oklch(), no web fonts you can rely
// on, no SVG — so the Bold Playful theme tokens from globals.css are
// converted to plain hex here, once. Keep these in step with the :root
// block in src/app/globals.css if the default theme changes.
export const EMAIL_COLORS = {
  bg: "#f1f0fc",
  surface: "#ffffff",
  ink: "#1a182a",
  text: "#1f1d2d",
  muted: "#6e6d7a",
  border: "#dddceb",
  primary: "#b64ebd",
  primarySoft: "#f3d7f4",
  glow: "#d85891",
  secondary: "#e6b816",
  secondarySoft: "#f7e7bb",
} as const;

// A system font stack every mail client has — the app's own fonts
// (Nunito, Fredoka, Dancing Script) would silently fall back anyway.
export const EMAIL_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
