-- Found while building the vendor gallery: an inline
-- `exists (select 1 from public.vendors where ...)` subquery inside a
-- storage.objects RLS policy's WITH CHECK reliably evaluated to false even
-- when the exact same row was confirmed visible to the same user via a
-- normal PostgREST select — a nested-RLS-across-schemas quirk specific to
-- policies evaluated from within Storage's own policy context, not
-- something that shows up on an ordinary table's own RLS. Isolated by
-- testing each clause of the policy in isolation directly against the
-- local stack (bucket_id alone: passed; auth.uid() is not null: passed;
-- is_vendor_team_member(...): passed; the inline vendors EXISTS clause
-- alone: failed) before concluding it wasn't a logic bug in the policy's
-- boolean expression, but the inline subquery itself.
--
-- The fix is the same principle this project has used since Phase 0 for
-- every other cross-table RLS check: route it through a SECURITY DEFINER
-- function instead of inlining a subquery against another RLS-protected
-- table. It bypasses whatever the nested-evaluation quirk actually is, the
-- same way it already sidesteps RLS-policy-cycle recursion elsewhere.
create or replace function public.is_vendor_verified(p_vendor_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.vendors where id = p_vendor_id and verification_status = 'verified'
  );
$$;

grant execute on function public.is_vendor_verified(uuid) to authenticated, anon;

-- Replace the debug policies from the diagnosis session with the final,
-- correct ones — same shape as before, just calling the function instead
-- of inlining the subquery.
drop policy if exists "vendor_gallery_insert_debug" on storage.objects;
drop policy if exists "vendor_gallery_insert_debug2" on storage.objects;
drop policy if exists "vendor_gallery_insert_debug3" on storage.objects;
drop policy if exists "vendor_gallery_insert_debug4" on storage.objects;
drop policy if exists "vendor_gallery_insert_debug5" on storage.objects;
drop policy if exists "vendor_gallery_insert_owner_or_manager_if_verified" on storage.objects;

create policy "vendor_gallery_insert_owner_or_manager_if_verified"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vendor-gallery'
  and public.is_vendor_team_member((storage.foldername(name))[1]::uuid, auth.uid(), array['owner', 'manager'])
  and public.is_vendor_verified((storage.foldername(name))[1]::uuid)
);
