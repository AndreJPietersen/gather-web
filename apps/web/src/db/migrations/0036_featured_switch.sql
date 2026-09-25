-- The one settings row, featured vendors switched ON (Andre's call while the
-- app is in development).
INSERT INTO "app_settings" ("id", "featured_enabled") VALUES (true, true) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- Same two computed columns as before (vendor_featured_functions), now also
-- gated on the global switch: when featured vendors are turned off in the
-- admin console, every vendor reads as not featured and unranked, so badges,
-- the Featured row and the ranking boost all disappear together without
-- touching a single placement. A missing settings row counts as ON.
CREATE OR REPLACE FUNCTION public.is_featured(v public.vendors)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT s.featured_enabled FROM public.app_settings s WHERE s.id), true)
    AND EXISTS (
      SELECT 1 FROM public.vendor_feature_placements p
      WHERE p.vendor_id = v.id
        AND p.status = 'activated'
        AND (now() AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p.starts_on AND p.ends_on
    );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.featured_rank(v public.vendors)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN COALESCE((SELECT s.featured_enabled FROM public.app_settings s WHERE s.id), true)
    THEN (
      SELECT min(p.position) FROM public.vendor_feature_placements p
      WHERE p.vendor_id = v.id
        AND p.status = 'activated'
        AND (now() AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p.starts_on AND p.ends_on
    )
  END;
$$;
