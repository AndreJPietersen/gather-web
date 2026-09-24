-- vendor_team_members_update_by_owner lets an Owner update rows on their own
-- team, but RLS checks *which rows*, not *which columns*: an Owner could have
-- re-pointed an existing membership at a different user_id (planting a
-- stranger on the team without an invite). The app only ever changes role and
-- is_active (the team page), so signed-in users are limited to exactly those
-- two columns. The service role (admin console, onboarding) is unaffected.
REVOKE UPDATE ON public.vendor_team_members FROM anon, authenticated;
GRANT UPDATE (role, is_active) ON public.vendor_team_members TO authenticated;
