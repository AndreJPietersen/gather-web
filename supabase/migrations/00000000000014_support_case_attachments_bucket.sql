-- The optional screenshot on the self-service "Report an Issue" form
-- (support_cases.attachment_path). Private, image-only (a screenshot of a
-- bug or a payment issue, not a document — payment-proofs is the bucket
-- that takes PDFs, this one deliberately doesn't need to), same 5MB cap as
-- every other image-only bucket in this app (event-gallery, vendor-gallery).
--
-- Scoped by the REPORTING USER's own id ("{auth.uid()}/{uuid}.ext"), not by
-- case id like every other per-record bucket in this app (event-gallery,
-- payment-proofs) — deliberately, because the case row doesn't exist yet at
-- the moment of upload: the new-case Server Action uploads the image first,
-- then inserts the support_cases row with attachment_path already pointing
-- at it, avoiding a chicken-and-egg RLS check against a case that isn't
-- there yet. A plain "my own folder" policy needs no EXISTS join at all.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-case-attachments', 'support-case-attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Read is owner-only via RLS; the admin console never needs a branch here
-- because it reads through the service-role client (createServiceClient()),
-- which bypasses storage RLS the same way it bypasses every table's RLS.
create policy "support_case_attachments_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'support-case-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "support_case_attachments_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'support-case-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Needed so the new-case action can roll back its own upload if the
-- support_cases insert that follows it fails (the same rollback-on-failure
-- shape uploadEventGalleryImage already uses) — without this, a failed
-- submission would leave an orphaned file in the reporter's own folder with
-- no way for their own (non-service-role) request to clean it up.
create policy "support_case_attachments_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'support-case-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
