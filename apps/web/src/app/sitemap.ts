import type { MetadataRoute } from "next";
import { emailSiteUrl } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/service";

// Reads the database at request time, not build time (the build has no
// database in CI), and only lists what is already public: verified,
// non-hidden businesses and published public events.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = emailSiteUrl();
  const entries: MetadataRoute.Sitemap = ["", "/vendors", "/faq", "/privacy", "/terms"].map((p) => ({ url: `${site}${p}` }));
  try {
    const db = createServiceClient();
    const [vendors, events] = await Promise.all([
      db.from("vendors").select("id").eq("verification_status", "verified").is("hidden_at", null).limit(5000),
      db.from("events").select("id, updated_at").eq("status", "published").eq("visibility", "public").limit(5000),
    ]);
    for (const v of vendors.data ?? []) entries.push({ url: `${site}/vendors/${v.id}` });
    for (const e of events.data ?? []) entries.push({ url: `${site}/events/${e.id}`, lastModified: e.updated_at ?? undefined });
  } catch {
    // Static entries only if the database is unreachable.
  }
  return entries;
}
