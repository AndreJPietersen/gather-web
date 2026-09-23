-- Chat ring-fenced to one event_vendors row (one event + one vendor
-- booking). event-vendor-chat is PRIVATE like event-gallery, not public
-- like vendor-gallery — a booking's chat is between exactly two specific
-- parties about a specific engagement, more sensitive than a vendor's own
-- public marketing gallery, not less.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-vendor-chat', 'event-vendor-chat', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Objects are uploaded at "{eventVendorId}/{filename}", same
-- storage.foldername(name) convention as vendor-gallery/event-gallery
-- above. This is a genuinely new policy shape though: neither existing
-- bucket does event-side-OR-vendor-side on storage.objects (event-gallery
-- is event-only, vendor-gallery is vendor-only) — chat needs both, so each
-- policy here joins out to event_vendors to resolve both the event_id and
-- vendor_id behind one event_vendor_id folder segment, the same EXISTS
-- shape event_vendor_messages' own RLS (src/db/schema.ts) uses for the
-- database row; as with the other two buckets, that row-level policy and
-- this object-level one are independent enforcement of the same rule, not
-- a substitute for each other.
create policy "event_vendor_chat_select_event_side_or_vendor_side"
on storage.objects for select
to authenticated
using (
  bucket_id = 'event-vendor-chat'
  and exists (
    select 1 from event_vendors ev where ev.id = (storage.foldername(name))[1]::uuid and (
      public.is_event_owner(ev.event_id, auth.uid())
      or public.is_event_collaborator(ev.event_id, auth.uid())
      or public.is_vendor_team_member(ev.vendor_id, auth.uid())
    )
  )
);

-- Event side: owner or accepted Editor, matching event_vendor_messages'
-- own INSERT policy. Vendor side: any active team member, no role
-- filter — chat is day-to-day communication, not a management action.
create policy "event_vendor_chat_insert_event_editor_or_vendor_member"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-vendor-chat'
  and exists (
    select 1 from event_vendors ev where ev.id = (storage.foldername(name))[1]::uuid and (
      public.is_event_owner(ev.event_id, auth.uid())
      or public.is_event_collaborator(ev.event_id, auth.uid(), 'editor')
      or public.is_vendor_team_member(ev.vendor_id, auth.uid())
    )
  )
);

-- Realtime: enable postgres_changes delivery for this table. Supabase's
-- Postgres Changes evaluates the subscribing user's own RLS SELECT policy
-- per row before delivering a change over the socket, so
-- event_vendor_messages_select_event_side_or_vendor_side (src/db/schema.ts)
-- is what actually gates who receives a live message — this line only
-- turns delivery on at all; it grants no additional access by itself.
alter publication supabase_realtime add table public.event_vendor_messages;
