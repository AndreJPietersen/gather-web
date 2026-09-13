-- Helper functions for RLS policies, SECURITY DEFINER on purpose.
--
-- Without this, a naive policy on `events` that correlated-subqueries
-- `event_collaborators` (to check "am I an accepted collaborator on this
-- event?"), combined with `event_collaborators` having its own policy that
-- subqueries `events` back (to check "am I this event's owner?"), forms a
-- genuine cycle: reading events requires evaluating event_collaborators'
-- RLS, which requires evaluating events' RLS again, indefinitely. Postgres
-- detects this and raises "infinite recursion detected in policy" (42P17)
-- rather than looping forever. This is a well-known Postgres/Supabase RLS
-- pitfall whenever two tables' policies reference each other (or a table
-- references itself), not something specific to a mistake in this schema.
--
-- A SECURITY DEFINER function runs its internal query as the function's
-- owner (whoever ran this migration — a superuser/table owner), which
-- bypasses RLS by default. Routing cross-table (and self-referencing)
-- checks through these functions instead of inline EXISTS subqueries
-- breaks the cycle, because the function's internal SELECT never re-enters
-- the calling table's own policy evaluation.

create or replace function public.is_event_owner(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.events where id = p_event_id and owner_id = p_user_id
  );
$$;

create or replace function public.is_event_collaborator(p_event_id uuid, p_user_id uuid, p_min_permission text default null)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.event_collaborators
    where event_id = p_event_id
      and user_id = p_user_id
      and status = 'accepted'
      and (p_min_permission is null or permission_level::text = p_min_permission)
  );
$$;

create or replace function public.is_vendor_creator(p_vendor_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.vendors where id = p_vendor_id and created_by = p_user_id
  );
$$;

create or replace function public.is_vendor_team_member(p_vendor_id uuid, p_user_id uuid, p_roles text[] default null)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.vendor_team_members
    where vendor_id = p_vendor_id
      and user_id = p_user_id
      and is_active = true
      and (p_roles is null or role::text = any(p_roles))
  );
$$;

grant execute on function public.is_event_owner(uuid, uuid) to authenticated, anon;
grant execute on function public.is_event_collaborator(uuid, uuid, text) to authenticated, anon;
grant execute on function public.is_vendor_creator(uuid, uuid) to authenticated, anon;
grant execute on function public.is_vendor_team_member(uuid, uuid, text[]) to authenticated, anon;
