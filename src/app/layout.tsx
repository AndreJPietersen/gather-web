import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

// next/font self-hosts these automatically at build time — the prototype's
// `@import url('fonts.googleapis.com/...')` doesn't need porting at all,
// unlike the LWR/Salesforce build where that required a manual static
// resource + Head Markup workaround (see docs/gather_web_architecture.md).
const fredoka = Fredoka({
  variable: "--font-display",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-body",
  weight: ["400", "600", "700", "800"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gather",
  description: "Plan it. Book it. Pull it off.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg font-body text-text">{children}</body>
    </html>
  );
}
