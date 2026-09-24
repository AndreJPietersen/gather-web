-- Admin watchlist: patterns that suggest someone is flooding the marketplace
-- (mass listings, sock-puppet teams, claim sprees, invite floods, look-alike
-- listings sharing contact details). It only *reports*; nothing is blocked.
-- Thresholds are parameters so they live in one place in app code
-- (src/lib/admin/watchlist.ts) and can be tuned without a migration.
--
-- SECURITY DEFINER so it can read auth.users for emails (display names are
-- optional); EXECUTE is revoked from everyone but service_role, so it is only
-- reachable from admin code that has already passed requireAdmin().

CREATE OR REPLACE FUNCTION public.admin_watchlist(
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
  subject_id uuid,
  subject_label text,
  hits int,
  detail text
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
  )
  -- Many listings created by one person in a short window (their own
  -- businesses and planner stubs alike).
  SELECT 'listing_burst', v.created_by, pe.label, count(*)::int,
         string_agg(v.name, ', ' ORDER BY v.created_at DESC)
  FROM public.vendors v JOIN people pe ON pe.id = v.created_by
  WHERE v.created_at > now() - make_interval(days => p_listing_days)
  GROUP BY v.created_by, pe.label
  HAVING count(*) >= p_listing_min

  UNION ALL
  -- One person sitting on many vendor teams, in any role.
  SELECT 'team_seats', m.user_id, pe.label, count(*)::int,
         string_agg(v.name || ' (' || m.role || ')', ', ' ORDER BY m.created_at DESC)
  FROM public.vendor_team_members m
  JOIN public.vendors v ON v.id = m.vendor_id
  JOIN people pe ON pe.id = m.user_id
  WHERE m.is_active
  GROUP BY m.user_id, pe.label
  HAVING count(*) >= p_team_min

  UNION ALL
  -- Claiming lots of listings.
  SELECT 'claim_spree', c.created_by, pe.label, count(*)::int,
         string_agg(v.name || ' — ' || c.status, ', ' ORDER BY c.created_at DESC)
  FROM public.vendor_claim_requests c
  JOIN public.vendors v ON v.id = c.vendor_id
  JOIN people pe ON pe.id = c.created_by
  WHERE c.created_at > now() - make_interval(days => p_claim_days)
  GROUP BY c.created_by, pe.label
  HAVING count(*) >= p_claim_min

  UNION ALL
  -- Sending lots of team invites.
  SELECT 'invite_flood', i.invited_by, pe.label, count(*)::int,
         count(DISTINCT i.vendor_id)::text || ' businesses, ' || count(DISTINCT lower(i.invited_email))::text || ' addresses'
  FROM public.vendor_team_invites i
  JOIN people pe ON pe.id = i.invited_by
  WHERE i.created_at > now() - make_interval(days => p_invite_days)
  GROUP BY i.invited_by, pe.label
  HAVING count(*) >= p_invite_min

  UNION ALL
  -- Several listings sharing one phone number or website — the tell-tale of
  -- one operator posting look-alike businesses.
  SELECT 'shared_contact', NULL::uuid, k.contact, count(*)::int,
         string_agg(k.name, ', ' ORDER BY k.name)
  FROM (
    SELECT v.name, 'Phone ' || regexp_replace(v.phone, '\D', '', 'g') AS contact
    FROM public.vendors v
    WHERE length(regexp_replace(coalesce(v.phone, ''), '\D', '', 'g')) >= 7
    UNION ALL
    SELECT v.name, 'Website ' || regexp_replace(regexp_replace(lower(trim(v.website)), '^https?://(www\.)?', ''), '/+$', '')
    FROM public.vendors v
    WHERE coalesce(trim(v.website), '') <> ''
  ) k
  GROUP BY k.contact
  HAVING count(*) >= p_contact_min;
$$;

REVOKE ALL ON FUNCTION public.admin_watchlist(int, int, int, int, int, int, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_watchlist(int, int, int, int, int, int, int, int) TO service_role;
