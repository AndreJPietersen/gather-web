-- Closes the gap left by suspension-by-auth-ban: the ban stops sign-in and
-- token refresh at once, and Gather's own pages treat the user as signed out
-- (auth.getUser() fails), but an access token issued *before* the ban stays
-- valid against the raw API until it expires (up to an hour). For the tables
-- someone flooding the marketplace would write to, a suspended user's inserts
-- are refused outright in the database.
--
-- Service-role writes (no auth.uid()) are never affected.

CREATE OR REPLACE FUNCTION public.block_suspended_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_suspensions s WHERE s.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Account suspended' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_suspended_writes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS block_suspended_writes ON public.vendors;
CREATE TRIGGER block_suspended_writes BEFORE INSERT OR UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();

DROP TRIGGER IF EXISTS block_suspended_writes ON public.vendor_claim_requests;
CREATE TRIGGER block_suspended_writes BEFORE INSERT ON public.vendor_claim_requests
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();

DROP TRIGGER IF EXISTS block_suspended_writes ON public.vendor_team_invites;
CREATE TRIGGER block_suspended_writes BEFORE INSERT ON public.vendor_team_invites
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();

DROP TRIGGER IF EXISTS block_suspended_writes ON public.vendor_business_requests;
CREATE TRIGGER block_suspended_writes BEFORE INSERT ON public.vendor_business_requests
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();

DROP TRIGGER IF EXISTS block_suspended_writes ON public.event_vendors;
CREATE TRIGGER block_suspended_writes BEFORE INSERT ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_writes();
