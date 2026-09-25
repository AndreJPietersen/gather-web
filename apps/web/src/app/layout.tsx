import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/app-shell";
import { getSessionContext } from "@/lib/session";
import "./globals.css";

// Fonts are bundled in ./fonts (latin subset) and loaded with next/font/local,
// so the build never downloads anything — next/font/google fetched them from
// Google at build time and failed on GitHub's CI runners. Still self-hosted
// and preloaded by Next. See ./fonts/README.md.
const fredoka = localFont({
  variable: "--font-display",
  src: [{ path: "./fonts/Fredoka-latin.woff2", weight: "500 700", style: "normal" }],
  display: "swap",
});

const nunito = localFont({
  variable: "--font-body",
  src: [
    { path: "./fonts/Nunito-latin.woff2", weight: "400 800", style: "normal" },
    { path: "./fonts/Nunito-Italic-latin.woff2", weight: "400 800", style: "italic" },
  ],
  display: "swap",
});

// The cursive "Gather" wordmark only — see GatherWordmark
// (src/components/brand/gather-wordmark.tsx). Loaded separately since it is
// used nowhere else in the app.
const dancingScript = localFont({
  variable: "--font-script",
  src: [{ path: "./fonts/DancingScript-Bold-latin.woff2", weight: "700", style: "normal" }],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gather",
  description: "Plan it. Book it. Pull it off.",
};

// viewport-fit=cover is what makes env(safe-area-inset-bottom) resolve to a
// real value instead of 0 on iOS Safari — required for the fixed bottom tab
// bar to clear the home-indicator area rather than sit under it. themeColor
// tints the Android browser chrome / task switcher and the PWA splash
// screen (see manifest.ts) — bold-playful's own --color-primary, resolved
// to a fixed hex since neither has access to the in-page CSS theme.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#b64ebd",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSessionContext();

  return (
    // suppressHydrationWarning is React's sanctioned, shallow (attribute-only)
    // escape hatch for exactly this case: the inline script below sets
    // data-theme from localStorage before hydration runs, which the server
    // (which has no access to localStorage) can never predict. It does not
    // suppress mismatches in any child content — theme must never branch
    // rendered JSX (only CSS variables), or a real hydration error would
    // still surface. See theme-store.ts for the full reasoning.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fredoka.variable} ${nunito.variable} ${dancingScript.variable} h-full antialiased`}
    >
      <head>
        {/* A plain <script> tag here (tried next/script's beforeInteractive
            strategy instead, to silence a cosmetic React devtools warning
            that fires on notFound()/error pages — it made the flash-of-
            wrong-theme problem this script exists to prevent come back,
            since "beforeInteractive" only guarantees "before hydration,"
            not "before first paint," which is what genuinely matters here.
            Reverted; the warning is real but console-only and appears
            solely on 404-type pages, a fair trade against silently
            reintroducing a real visible flash on every normal page load.) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{' +
              'var t=localStorage.getItem("gather-theme");' +
              'if(t==="ocean-current"||t==="sunset-social")document.documentElement.setAttribute("data-theme",t);' +
              'var p=localStorage.getItem("gather-bg-pattern");' +
              'if(p==="none"||p==="category-confetti"||p==="gradient-confetti"||p==="corner-burst")document.documentElement.setAttribute("data-bg-pattern",p);' +
              '}catch(e){}',
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg font-body text-text">
        <AppShell session={session}>{children}</AppShell>
      </body>
    </html>
  );
}
