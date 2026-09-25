-- Per-person hourly write limits on every table a signed-in user can insert
-- into (the ones not already covered: vendors has its own daily cap). Stops
-- anyone flooding the database — and so the site — through the public API.
-- Limits are generous for real use and editable at /admin/settings.
--
-- How it works: a BEFORE INSERT trigger counts the caller's rows for this
-- table in user_write_log over the last hour; at the limit it refuses the
-- insert, otherwise it logs this one. Service-role inserts (auth.uid() is
-- null: admin console, guest RSVP, seeds) are never limited. Log rows older
-- than a day are pruned per user as they go, so the table stays small.

INSERT INTO public.write_rate_limits (table_name, label, max_per_hour) VALUES
  ('events', 'Events created', 20),
  ('event_collaborators', 'Co-planner invites', 60),
  ('event_attendees', 'Guests added', 500),
  ('event_tasks', 'Tasks added', 300),
  ('budget_items', 'Budget items added', 200),
  ('event_vendors', 'Vendors added to events', 100),
  ('event_vendor_messages', 'Chat messages sent', 300),
  ('event_gallery_images', 'Event photos added', 100),
  ('event_mood_board_photos', 'Mood board photos added', 100),
  ('payment_plans', 'Payment plans created', 100),
  ('payment_installments', 'Installments added', 300),
  ('vendor_claim_requests', 'Listing claims', 10),
  ('vendor_team_invites', 'Team invites sent', 30),
  ('vendor_services', 'Vendor services added', 100),
  ('vendor_gallery_images', 'Vendor photos added', 100),
  ('vendor_quotes', 'Quotes sent', 100),
  ('vendor_reviews', 'Reviews written', 20),
  ('vendor_review_replies', 'Review replies', 60),
  ('support_cases', 'Support cases filed', 10),
  ('vendor_business_requests', 'Business requests', 5)
ON CONFLICT (table_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_write_rate_limit()
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
  SELECT max_per_hour INTO v_limit FROM public.write_rate_limits WHERE table_name = TG_TABLE_NAME;
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_recent
  FROM public.user_write_log
  WHERE user_id = v_uid AND table_name = TG_TABLE_NAME AND created_at > now() - interval '1 hour';
  IF v_recent >= v_limit THEN
    RAISE EXCEPTION 'Rate limit reached for %', TG_TABLE_NAME USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.user_write_log (user_id, table_name) VALUES (v_uid, TG_TABLE_NAME);
  DELETE FROM public.user_write_log WHERE user_id = v_uid AND created_at < now() - interval '1 day';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_write_rate_limit() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT table_name FROM public.write_rate_limits LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_write_rate_limit ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE TRIGGER enforce_write_rate_limit BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit()',
      t.table_name
    );
  END LOOP;
END $$;

-- Uploads: a signed-in user who can write to a bucket could otherwise upload
-- files without end (each capped by the bucket's size limit). Same limit
-- mechanism, keyed as 'storage.objects'. Hosted Supabase may not let the
-- migration role add triggers to storage.objects; if so this step is skipped
-- with a notice rather than failing the whole migration.
INSERT INTO public.write_rate_limits (table_name, label, max_per_hour) VALUES ('objects', 'File uploads', 200)
ON CONFLICT (table_name) DO NOTHING;
DO $$
BEGIN
  DROP TRIGGER IF EXISTS enforce_write_rate_limit ON storage.objects;
  CREATE TRIGGER enforce_write_rate_limit BEFORE INSERT ON storage.objects
    FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipped upload rate limit: no permission to add a trigger on storage.objects';
END $$;
