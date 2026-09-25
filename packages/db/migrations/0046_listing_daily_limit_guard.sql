-- Enforces app_settings.listing_daily_limit on every vendor insert made by a
-- signed-in user, whether it came through Gather's pages or straight at the
-- API with the anon key. Inserts with no auth.uid() (the service role: admin
-- console, seed scripts) are exempt — those are trusted paths.
--
-- SECURITY DEFINER so the count sees every row the user created, not just
-- the ones RLS lets them read back (hidden ones included).

CREATE OR REPLACE FUNCTION public.enforce_listing_daily_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit int;
  v_recent int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE((SELECT s.listing_daily_limit FROM public.app_settings s WHERE s.id), 10) INTO v_limit;
  SELECT count(*) INTO v_recent
  FROM public.vendors v
  WHERE v.created_by = v_uid AND v.created_at > now() - interval '24 hours';
  IF v_recent >= v_limit THEN
    RAISE EXCEPTION 'Daily listing limit reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_listing_daily_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_listing_daily_limit ON public.vendors;
CREATE TRIGGER enforce_listing_daily_limit
  BEFORE INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_daily_limit();
