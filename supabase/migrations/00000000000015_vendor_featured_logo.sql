-- Vendor marketplace redesign: an admin-curated Featured flag (paid-
-- placement style boost) and a dedicated vendor logo/avatar. The logo
-- itself is a plain vendor-writable column (same tier as name/description/
-- phone/website — see vendors.logoPath's own comment in schema.ts for why
-- it's deliberately NOT gated behind verification the way the gallery
-- bucket is) and needed no new migration beyond the drizzle-generated
-- ALTER TABLE. is_featured is the one that actually needs new protection.
--
-- Row Level Security is row-level only — vendors_update_creator_stub_or_
-- owner_manager already lets a stub creator or owner/manager UPDATE their
-- own vendor row, and a plain RLS policy has no way to say "except this one
-- column." Left alone, adding is_featured as a normal column would let any
-- vendor owner set their own Featured flag via a direct PostgREST PATCH,
-- bypassing the whole point of it being admin-curated.
--
-- This is the exact same fix already applied once in this project for
-- profiles.is_admin (00000000000009_profiles_column_grants.sql) — teachAndre/
-- 09 has the full story of why a plain column-level REVOKE alone silently
-- does nothing here: it can't carve an exception out of the broader
-- table-level GRANT this table already has (00000000000003_restore_public_
-- grants.sql), so the only way to actually restrict a column is the reverse
-- order — revoke the table-level UPDATE entirely, then grant it back only on
-- the columns a vendor should actually be able to write themselves.
--
-- verification_status is included in the exclusion here too, not just
-- is_featured — a latent version of the exact same gap (nothing was ever
-- stopping a vendor from self-verifying via a raw PATCH; only the app's own
-- forms never sent that field), found and closed while doing this properly
-- for the column it's now sitting directly next to.
revoke update on public.vendors from authenticated;
grant update (name, primary_category, description, phone, website, logo_path) on public.vendors to authenticated;

-- Private-marketing-content bucket, same public-read posture as
-- vendor-gallery (a vendor's logo is shown to anyone browsing the
-- directory, logged in or not) — see that bucket's own migration comment
-- (00000000000010_gallery_storage_buckets.sql) for why "public" only
-- controls unauthenticated READ, not write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-logos', 'vendor-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "vendor_logos_select_public"
on storage.objects for select
to public
using (bucket_id = 'vendor-logos');

-- Owner/manager only, deliberately no verification_status gate (unlike
-- vendor_gallery_insert_owner_or_manager_if_verified) — see the logoPath
-- comment in schema.ts.
create policy "vendor_logos_insert_owner_or_manager"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vendor-logos'
  and public.is_vendor_team_member((storage.foldername(name))[1]::uuid, auth.uid(), array['owner', 'manager'])
);

create policy "vendor_logos_delete_owner_or_manager"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vendor-logos'
  and public.is_vendor_team_member((storage.foldername(name))[1]::uuid, auth.uid(), array['owner', 'manager'])
);
