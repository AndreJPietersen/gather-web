-- Follow-up to 0049: a vendor's review reply is saved with an upsert
-- (INSERT ... ON CONFLICT (vendor_review_id) DO UPDATE SET <every column
-- sent>), and Postgres requires UPDATE privilege on each of those columns —
-- so limiting UPDATE to (reply_text, updated_at) broke editing a reply.
-- vendor_review_id and replied_by are safe to include: the update policy
-- (vendor_review_replies_update_vendor_manager) still only allows rows whose
-- review belongs to a vendor the caller manages, and the upsert only ever
-- rewrites them to the values they already had.
GRANT UPDATE (vendor_review_id, replied_by) ON public.vendor_review_replies TO authenticated;
