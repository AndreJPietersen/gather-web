import type { MetadataRoute } from "next";
import { emailSiteUrl } from "@/lib/email";

// Public pages may be indexed; signed-in areas, the admin console and auth
// flows may not.
export default function robots(): MetadataRoute.Robots {
  const site = emailSiteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/profile", "/onboarding", "/choose-persona", "/auth", "/reset-password", "/unsubscribe"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
