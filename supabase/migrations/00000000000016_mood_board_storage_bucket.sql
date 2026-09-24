-- The mood board's own bucket, deliberately separate from event-gallery —
-- same reasoning as keeping event_mood_board_photos its own table rather
-- than adding an is_featured column to event_gallery_images: the two are
-- meant to stay independent features, not one photo pool with two skins.
-- Private, same as event-gallery, same reason: personal planning content,
-- not for public viewing. Same {eventId}/{filename} object-path convention,
-- same owner-or-collaborator (select) / owner-or-editor (insert/delete)
-- RLS shape as every other private per-event bucket in this app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-mood-board', 'event-mood-board', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "event_mood_board_select_owner_or_collaborator"
on storage.objects for select
to authenticated
using (
  bucket_id = 'event-mood-board'
  and (
    public.is_event_owner((storage.foldername(name))[1]::uuid, auth.uid())
    or public.is_event_collaborator((storage.foldername(name))[1]::uuid, auth.uid())
  )
);

create policy "event_mood_board_insert_owner_or_editor"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-mood-board'
  and (
    public.is_event_owner((storage.foldername(name))[1]::uuid, auth.uid())
    or public.is_event_collaborator((storage.foldername(name))[1]::uuid, auth.uid(), 'editor')
  )
);

create policy "event_mood_board_delete_owner_or_editor"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'event-mood-board'
  and (
    public.is_event_owner((storage.foldername(name))[1]::uuid, auth.uid())
    or public.is_event_collaborator((storage.foldername(name))[1]::uuid, auth.uid(), 'editor')
  )
);
