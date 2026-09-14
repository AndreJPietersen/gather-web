-- Phase 10 — see docs/gather_web_admin_architecture.md's "Why not just read
-- the column" section for the full reasoning.
--
-- profiles_select_all_authenticated grants full-row SELECT to any signed-in
-- OR anonymous request (using: true) — already a known, flagged looseness
-- (see the phone column's own history). A plain `profiles.is_admin` column
-- would therefore make "who are the admins" queryable by anyone. Routing the
-- check through a SECURITY DEFINER function instead returns only a boolean
-- to the caller, regardless of how loose the underlying table's own SELECT
-- policy stays — the same is_event_owner/is_vendor_team_member pattern from
-- 00000000000002, just for an admin-only check rather than a cross-table
-- RLS cycle.

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select is_admin from public.profiles where id = p_user_id),
    false
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated, anon;
