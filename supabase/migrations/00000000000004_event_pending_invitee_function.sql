-- Phase 5 gap, found building the collaborator-invite UI: a pending
-- invitee (event_collaborators.status = 'invited') could see their own
-- invite row (self-select policy) but not the event it points to — the
-- events table's RLS correctly requires an *accepted* collaboration
-- (is_event_collaborator filters on status = 'accepted'), so the event
-- name a Profile page would want to show alongside "Accept/Decline" was
-- silently hidden. The Salesforce-era build hit this exact same gap
-- building the equivalent screen (gatherProfile's pending-invite cards
-- needed Event__r.Name added to EventCollaboratorSelector.selectPendingForUser)
-- — this is that same fix, ported.
--
-- SECURITY DEFINER for the same reason as the other helpers in
-- 00000000000002_rls_helper_functions.sql: routes the cross-table check
-- through a function that bypasses RLS internally, consistent house style
-- even though a plain inline EXISTS wouldn't actually recurse here (this
-- function queries event_collaborators, whose own SELECT policy never
-- queries events back through anything other than the already-SECURITY-
-- DEFINER is_event_owner).

create or replace function public.is_event_pending_invitee(p_event_id uuid, p_user_id uuid)
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
      and status = 'invited'
  );
$$;

grant execute on function public.is_event_pending_invitee(uuid, uuid) to authenticated, anon;
