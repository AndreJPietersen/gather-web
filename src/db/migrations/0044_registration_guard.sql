-- The real enforcement for the sign-up kill switch (app_settings.
-- registration_enabled). Supabase's signup endpoint can be called straight
-- from a browser with the public anon key, skipping Gather's register page
-- and its check — so the refusal has to happen where every new account ends
-- up: a row in auth.users. BEFORE INSERT, so nothing is created at all.
--
-- Note this also stops accounts made through the Supabase dashboard or the
-- auth admin API while the switch is off — switch it back on first if an
-- account genuinely needs creating by hand.

CREATE OR REPLACE FUNCTION public.block_signup_when_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT COALESCE((SELECT s.registration_enabled FROM public.app_settings s WHERE s.id), true) THEN
    RAISE EXCEPTION 'Registration is closed' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_signup_when_closed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS block_signup_when_closed ON auth.users;
CREATE TRIGGER block_signup_when_closed
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_signup_when_closed();
