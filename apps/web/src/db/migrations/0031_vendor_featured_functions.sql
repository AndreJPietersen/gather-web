-- Carry every vendor that is featured today over as an activated placement
-- before the old is_featured column is dropped (next migration), so nobody
-- silently loses their spot. Open for a year from today, unpinned (rotating),
-- with a note so an admin can see where it came from and tidy it up.
INSERT INTO "vendor_feature_placements" ("vendor_id", "status", "starts_on", "ends_on", "position", "created_by", "note")
SELECT v."id", 'activated', current_date, current_date + 365, NULL, v."created_by",
       'Carried over from the old featured flag — set real dates and position.'
FROM "vendors" v
WHERE v."is_featured";
--> statement-breakpoint
-- "Is this vendor featured right now?" and "at what pinned rank?", exposed to
-- PostgREST as computed columns on vendors: because each function takes the
-- vendors row type as its only argument, .select("id, is_featured, featured_rank")
-- works on vendors exactly like a real column, so every page that already
-- selects is_featured keeps working unchanged after the column is dropped.
-- SECURITY DEFINER (the same pattern as is_vendor_verified/is_admin) is what
-- lets anon and authenticated users learn only this derived answer without
-- being able to read vendor_feature_placements itself — that table also holds
-- what a vendor paid and internal notes. "Today" is South African time, and
-- the window is inclusive on both ends.
CREATE OR REPLACE FUNCTION public.is_featured(v public.vendors)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_feature_placements p
    WHERE p.vendor_id = v.id
      AND p.status = 'activated'
      AND (now() AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p.starts_on AND p.ends_on
  );
$$;
--> statement-breakpoint
-- The best (lowest) pinned position among this vendor's live placements, or
-- NULL when it is either not featured or featured in the rotating pool —
-- callers check is_featured first to tell those two apart.
CREATE OR REPLACE FUNCTION public.featured_rank(v public.vendors)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT min(p.position) FROM public.vendor_feature_placements p
  WHERE p.vendor_id = v.id
    AND p.status = 'activated'
    AND (now() AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p.starts_on AND p.ends_on;
$$;
