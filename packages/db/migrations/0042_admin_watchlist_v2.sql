-- admin_watchlist v2 (see 0039 for the original and its reasoning). Changes:
--  * returns subject_key (stable id for dismissals: a user id, or the
--    normalised phone/website) and vendor_ids (so the page can offer
--    "hide these listings" in one click);
--  * ignores listings an admin has already hidden and users already
--    suspended, so dealt-with cases stop showing up.
-- The return type changes, so the old function has to be dropped first.

DROP FUNCTION IF EXISTS public.admin_watchlist(int, int, int, int, int, int, int, int);

CREATE FUNCTION public.admin_watchlist(
  p_listing_days int,
  p_listing_min int,
  p_team_min int,
  p_claim_days int,
  p_claim_min int,
  p_invite_days int,
  p_invite_min int,
  p_contact_min int
)
RETURNS TABLE (
  signal text,
  subject_key text,
  subject_id uuid,
  subject_label text,
  hits int,
  detail text,
  vendor_ids uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH people AS (
    SELECT p.id, COALESCE(NULLIF(p.display_name, ''), u.email, p.id::text) AS label
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE NOT EXISTS (SELECT 1 FROM public.user_suspensions s WHERE s.user_id = p.id)
  ),
  live_vendors AS (
    SELECT * FROM public.vendors WHERE hidden_at IS NULL
  )
  SELECT 'listing_burst', v.created_by::text, v.created_by, pe.label, count(*)::int,
         string_agg(v.name, ', ' ORDER BY v.created_at DESC), array_agg(v.id)
  FROM live_vendors v JOIN people pe ON pe.id = v.created_by
  WHERE v.created_at > now() - make_interval(days => p_listing_days)
  GROUP BY v.created_by, pe.label
  HAVING count(*) >= p_listing_min

  UNION ALL
  SELECT 'team_seats', m.user_id::text, m.user_id, pe.label, count(*)::int,
         string_agg(v.name || ' (' || m.role || ')', ', ' ORDER BY m.created_at DESC), array_agg(v.id)
  FROM public.vendor_team_members m
  JOIN live_vendors v ON v.id = m.vendor_id
  JOIN people pe ON pe.id = m.user_id
  WHERE m.is_active
  GROUP BY m.user_id, pe.label
  HAVING count(*) >= p_team_min

  UNION ALL
  SELECT 'claim_spree', c.created_by::text, c.created_by, pe.label, count(*)::int,
         string_agg(v.name || ' — ' || c.status, ', ' ORDER BY c.created_at DESC), array_agg(v.id)
  FROM public.vendor_claim_requests c
  JOIN live_vendors v ON v.id = c.vendor_id
  JOIN people pe ON pe.id = c.created_by
  WHERE c.created_at > now() - make_interval(days => p_claim_days)
  GROUP BY c.created_by, pe.label
  HAVING count(*) >= p_claim_min

  UNION ALL
  SELECT 'invite_flood', i.invited_by::text, i.invited_by, pe.label, count(*)::int,
         count(DISTINCT i.vendor_id)::text || ' businesses, ' || count(DISTINCT lower(i.invited_email))::text || ' addresses',
         array_agg(DISTINCT i.vendor_id)
  FROM public.vendor_team_invites i
  JOIN people pe ON pe.id = i.invited_by
  WHERE i.created_at > now() - make_interval(days => p_invite_days)
  GROUP BY i.invited_by, pe.label
  HAVING count(*) >= p_invite_min

  UNION ALL
  SELECT 'shared_contact', k.contact, NULL::uuid, k.contact, count(*)::int,
         string_agg(k.name, ', ' ORDER BY k.name), array_agg(k.id)
  FROM (
    SELECT v.id, v.name, 'Phone ' || regexp_replace(v.phone, '\D', '', 'g') AS contact
    FROM live_vendors v
    WHERE length(regexp_replace(coalesce(v.phone, ''), '\D', '', 'g')) >= 7
    UNION ALL
    SELECT v.id, v.name, 'Website ' || regexp_replace(regexp_replace(lower(trim(v.website)), '^https?://(www\.)?', ''), '/+$', '')
    FROM live_vendors v
    WHERE coalesce(trim(v.website), '') <> ''
  ) k
  GROUP BY k.contact
  HAVING count(*) >= p_contact_min;
$$;

REVOKE ALL ON FUNCTION public.admin_watchlist(int, int, int, int, int, int, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_watchlist(int, int, int, int, int, int, int, int) TO service_role;
