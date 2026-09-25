import { createServiceClient } from "@/lib/supabase/service";

// Whether the featured-vendor programme is switched on (admin console,
// /admin/featured). Public listings don't need to call this — the database's
// is_featured()/featured_rank() already respect it — but anything that
// invites a vendor to request a spot does. A missing row counts as on, the
// same default the SQL functions use.
export async function getFeaturedEnabled(): Promise<boolean> {
  const service = createServiceClient();
  const { data } = await service.from("app_settings").select("featured_enabled").eq("id", true).maybeSingle<{ featured_enabled: boolean }>();
  return data?.featured_enabled ?? true;
}

// Whether new accounts can be created (the sign-up kill switch,
// /admin/settings). The register page and action check this for a friendly
// message; the real enforcement is a trigger on auth.users.
export async function getRegistrationEnabled(): Promise<boolean> {
  const service = createServiceClient();
  const { data } = await service
    .from("app_settings")
    .select("registration_enabled")
    .eq("id", true)
    .maybeSingle<{ registration_enabled: boolean }>();
  return data?.registration_enabled ?? true;
}

// Listings (stubs or own businesses) one person may create per rolling 24
// hours — an anti-flooding cap. Planner stubs aren't owned, so the owner
// limits don't cover them, and they're the cheapest way to flood the
// marketplace. Enforced by a trigger on vendors; read here for the friendly
// message and the settings page.
export async function getListingDailyLimit(): Promise<number> {
  const service = createServiceClient();
  const { data } = await service
    .from("app_settings")
    .select("listing_daily_limit")
    .eq("id", true)
    .maybeSingle<{ listing_daily_limit: number }>();
  return data?.listing_daily_limit ?? 10;
}

// Businesses one person may own before needing an approved business request
// (the owner limit — /admin/settings, src/lib/vendor-business-rules.ts).
export async function getMaxOwnedBusinesses(): Promise<number> {
  const service = createServiceClient();
  const { data } = await service
    .from("app_settings")
    .select("max_owned_businesses")
    .eq("id", true)
    .maybeSingle<{ max_owned_businesses: number }>();
  return data?.max_owned_businesses ?? 5;
}

// The per-table hourly write limits the rate-limit trigger enforces
// (migration 0050), for the settings page.
export interface WriteRateLimit {
  table_name: string;
  label: string;
  max_per_hour: number;
}

export async function getWriteRateLimits(): Promise<WriteRateLimit[]> {
  const service = createServiceClient();
  const { data } = await service.from("write_rate_limits").select("table_name, label, max_per_hour").order("label");
  return (data ?? []) as WriteRateLimit[];
}

// Most recipients one admin email send may reach (/admin/emails/send).
export async function getMaxEmailRecipients(): Promise<number> {
  const service = createServiceClient();
  const { data } = await service
    .from("app_settings")
    .select("max_email_recipients")
    .eq("id", true)
    .maybeSingle<{ max_email_recipients: number }>();
  return data?.max_email_recipients ?? 500;
}

// How old (in minutes) an unreferenced uploaded file must be before the
// storage cleanup job deletes it (/admin/settings).
export async function getStorageCleanupMinAgeMinutes(): Promise<number> {
  const service = createServiceClient();
  const { data } = await service
    .from("app_settings")
    .select("storage_cleanup_min_age_minutes")
    .eq("id", true)
    .maybeSingle<{ storage_cleanup_min_age_minutes: number }>();
  return data?.storage_cleanup_min_age_minutes ?? 60;
}
