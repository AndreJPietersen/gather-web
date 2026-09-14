-- Fixes a real vulnerability found in code review, not a hypothetical one:
-- `is_admin(p_user_id uuid)` accepted an arbitrary target id and was granted
-- to `anon`. Since `profiles_select_all_authenticated` (using: true) already
-- lets anyone enumerate every profile id, a client could loop
-- `rpc('is_admin', { p_user_id: id })` over every id and reconstruct the
-- exact admin roster the function exists to hide — one boolean at a time
-- instead of one SELECT, but the same disclosure.
--
-- There's a second, more fundamental problem underneath that: Postgres RLS
-- is row-level only. `profiles_select_all_authenticated` being `using: true`
-- means the *row* is visible to anon/authenticated — which means every
-- column on it is too, including `is_admin`, directly via PostgREST
-- (`GET /rest/v1/profiles?select=is_admin`), completely bypassing the app
-- and the RPC "protection" either way. A SECURITY DEFINER function alone
-- was never going to close that; only revoking column-level access does.
--
-- Two independent fixes, both required:

-- 1. is_admin() now only ever answers for the CALLING user (auth.uid()
--    inside the function body), never an arbitrary argument — the only
--    thing requireAdmin() actually needed. A different signature than the
--    old one, so the vulnerable overload must be dropped explicitly, not
--    just shadowed by create-or-replace.
drop function if exists public.is_admin(uuid);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- 2. Revoke direct column access so the raw column can't be read via
--    PostgREST either, regardless of how the RPC behaves. is_admin() above
--    still works: it runs as the function's owner (a privileged role),
--    which bypasses column-level grants the same way SECURITY DEFINER
--    already bypasses RLS — this only blocks *callers*, not the function
--    itself.
revoke select (is_admin) on public.profiles from authenticated, anon;
