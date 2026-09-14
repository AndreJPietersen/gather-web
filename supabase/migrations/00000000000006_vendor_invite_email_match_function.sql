-- vendor_team_invites (unlike event_collaborators) is keyed by an email
-- address, not a user_id — per the ERD, this is deliberate: you can't
-- relate a Contact to a vendor Account until that person actually has a
-- login, so an invite record bridges "invited by email" and an active
-- vendor_team_members row, supporting inviting someone who doesn't have a
-- Gather account yet. That means RLS can't just compare a column to
-- auth.uid() the way every other invite-shaped table in this schema does —
-- it needs to know the CURRENT user's own email, which lives in the
-- protected auth.users schema, not anywhere RLS policies can read directly.
--
-- SECURITY DEFINER for the same reason as every other cross-table helper in
-- this project: this function's internal query runs as the function owner,
-- which is what allows it to read auth.users at all from within a policy
-- evaluation context that otherwise couldn't.

create or replace function public.invite_email_matches_current_user(p_invited_email text, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from auth.users where id = p_user_id and lower(email) = lower(p_invited_email)
  );
$$;

grant execute on function public.invite_email_matches_current_user(text, uuid) to authenticated, anon;
