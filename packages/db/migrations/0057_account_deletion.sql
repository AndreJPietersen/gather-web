-- Account deletion (App Store / POPIA "right to erasure").
--
-- Policy:
--   * events the person owns are deleted (with their guests, tasks, budget...)
--   * they are removed from every business team; a business left with nobody
--     active is hidden, not deleted (its bookings and reviews belong to others)
--   * everything else they authored (reviews, chat messages, support comments,
--     photos...) is kept for the other people involved but is re-pointed at a
--     placeholder "Deleted user" account, so their name is gone from it
--   * their sign-in, profile and preferences are deleted
--
-- The placeholder is a banned auth user with no password and no email that
-- works, so nobody can ever sign in as it.

INSERT INTO auth.users (id, instance_id, aud, role, email, banned_until, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '00000000-0000-4000-8000-00000000dead',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'deleted-user@gather.invalid', 'infinity', now(), now(), '{}', '{}'
)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO public.profiles (id, display_name)
VALUES ('00000000-0000-4000-8000-00000000dead', 'Deleted user')
ON CONFLICT (id) DO UPDATE SET display_name = 'Deleted user';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.delete_account(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  tomb constant uuid := '00000000-0000-4000-8000-00000000dead';
  r record;
  vendor_ids uuid[];
BEGIN
  IF p_user = tomb THEN
    RAISE EXCEPTION 'The placeholder account cannot be deleted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RAISE EXCEPTION 'No such account';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND is_admin) THEN
    RAISE EXCEPTION 'An admin account must have its admin access removed before it can be deleted';
  END IF;

  -- Their own events go, with everything hanging off them.
  DELETE FROM public.events WHERE owner_id = p_user;
  DELETE FROM public.event_collaborators WHERE user_id = p_user;
  DELETE FROM public.event_vendor_chat_reads WHERE user_id = p_user;

  -- Leave every business team; hide businesses left with no active member.
  SELECT coalesce(array_agg(DISTINCT vendor_id), '{}') INTO vendor_ids
  FROM public.vendor_team_members WHERE user_id = p_user;
  DELETE FROM public.vendor_team_members WHERE user_id = p_user;
  UPDATE public.vendors v SET hidden_at = coalesce(v.hidden_at, now())
  WHERE v.id = ANY (vendor_ids)
    AND NOT EXISTS (SELECT 1 FROM public.vendor_team_members m WHERE m.vendor_id = v.id AND m.is_active);

  -- Whatever else points at them: re-point at the placeholder (or null it if
  -- the column allows). Found by looking at the foreign keys, so a table added
  -- later is covered automatically. Tables that cascade or already set null on
  -- their own are left to do that.
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, a.attnotnull AS not_null
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'public.profiles'::regclass AND c.confdeltype NOT IN ('c', 'n')
  LOOP
    IF r.not_null THEN
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col) USING tomb, p_user;
    ELSE
      EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = $1', r.tbl, r.col, r.col) USING p_user;
    END IF;
  END LOOP;

  -- Finally the login itself; the profile, preferences and suspensions cascade.
  DELETE FROM auth.users WHERE id = p_user;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.delete_account(uuid) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.delete_account(uuid) TO service_role;
