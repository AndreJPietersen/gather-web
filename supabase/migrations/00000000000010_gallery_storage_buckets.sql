-- Two Storage buckets, first use of Supabase Storage in this project.
--
-- vendor-gallery is PUBLIC (read) — a vendor's gallery is marketing content
-- meant to be seen by anyone browsing the directory, same visibility as the
-- vendor row itself. event-gallery is PRIVATE — a planner's mood-board/
-- reference photos are personal planning content, not for public viewing;
-- display requires a signed URL generated server-side per request.
--
-- "Public" only controls unauthenticated READ access to objects — it does
-- NOT bypass RLS on storage.objects for INSERT/UPDATE/DELETE, which is what
-- the policies below actually enforce. A public bucket with no write
-- policies would still block every upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-gallery', 'vendor-gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-gallery', 'event-gallery', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Objects are uploaded at "{vendorId}/{filename}" / "{eventId}/{filename}"
-- — storage.foldername(name) is Supabase's own helper that splits an
-- object path into its folder segments, so (storage.foldername(name))[1]
-- recovers the vendor/event id to check against, the same
-- "scope uploads to a folder matching an owned resource" pattern Supabase's
-- own docs use for this exact case.
--
-- This INSERT check duplicates the same verified-only + owner-or-manager
-- condition already on vendor_gallery_images' own INSERT policy
-- (src/db/schema.ts) deliberately — that table's RLS gates the *database
-- row*, this gates the *actual file bytes*. Neither protects the other: a
-- client could try to upload straight to Storage without ever writing a
-- vendor_gallery_images row, or vice versa, so both layers need their own
-- independent enforcement of the same rule.
create policy "vendor_gallery_select_public"
on storage.objects for select
to public
using (bucket_id = 'vendor-gallery');

create policy "vendor_gallery_insert_owner_or_manager_if_verified"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vendor-gallery'
  and public.is_vendor_team_member((storage.foldername(name))[1]::uuid, auth.uid(), array['owner', 'manager'])
  and exists (
    select 1 from public.vendors v
    where v.id = (storage.foldername(name))[1]::uuid and v.verification_status = 'verified'
  )
);

create policy "vendor_gallery_delete_owner_or_manager"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vendor-gallery'
  and public.is_vendor_team_member((storage.foldername(name))[1]::uuid, auth.uid(), array['owner', 'manager'])
);

create policy "event_gallery_select_owner_or_collaborator"
on storage.objects for select
to authenticated
using (
  bucket_id = 'event-gallery'
  and (
    public.is_event_owner((storage.foldername(name))[1]::uuid, auth.uid())
    or public.is_event_collaborator((storage.foldername(name))[1]::uuid, auth.uid())
  )
);

create policy "event_gallery_insert_owner_or_editor"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-gallery'
  and (
    public.is_event_owner((storage.foldername(name))[1]::uuid, auth.uid())
    or public.is_event_collaborator((storage.foldername(name))[1]::uuid, auth.uid(), 'editor')
  )
);

create policy "event_gallery_delete_owner_or_editor"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'event-gallery'
  and (
    public.is_event_owner((storage.foldername(name))[1]::uuid, auth.uid())
    or public.is_event_collaborator((storage.foldername(name))[1]::uuid, auth.uid(), 'editor')
  )
);
