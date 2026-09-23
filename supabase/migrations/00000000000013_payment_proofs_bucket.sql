-- Proof-of-payment documents, attached directly to the installment they
-- prove. Private like event-gallery/event-vendor-chat — these are receipts
-- for a specific booking's money, not public content. Unlike every other
-- bucket in this app so far, this one accepts PDFs as well as images (a
-- forwarded bank confirmation or emailed receipt is at least as common a
-- shape here as a screenshot), and its file_size_limit is a little higher
-- than the 5MB image-only buckets — a scanned PDF receipt runs larger than
-- a compressed phone photo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Objects are uploaded at "{installmentId}/{filename}" — one join hop
-- deeper than event-gallery/vendor-gallery's own {eventId}/{vendorId}
-- folder keys, since payment_installments has no event_id/vendor_id of
-- its own; it only reaches them via payment_plans -> event_vendors, the
-- exact same two-hop EXISTS shape payment_installments' own RLS policies
-- (src/db/schema.ts) already use, just walked one more step from the
-- object's folder segment down to the installment row.
create policy "payment_proofs_select_event_side_or_vendor_side"
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and exists (
    select 1 from payment_installments pi
    join payment_plans pp on pp.id = pi.payment_plan_id
    join event_vendors ev on ev.id = pp.event_vendor_id
    where pi.id = (storage.foldername(name))[1]::uuid and (
      public.is_event_owner(ev.event_id, auth.uid())
      or public.is_event_collaborator(ev.event_id, auth.uid())
      or public.is_vendor_team_member(ev.vendor_id, auth.uid())
    )
  )
);

-- Editor-only, both insert and delete — no vendor-side branch at all,
-- matching payment_installments' own UPDATE policy (marking paid/refunded
-- is already a planner-only action in this app; attaching or removing the
-- proof for one is the same posture).
create policy "payment_proofs_insert_event_editor"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and exists (
    select 1 from payment_installments pi
    join payment_plans pp on pp.id = pi.payment_plan_id
    join event_vendors ev on ev.id = pp.event_vendor_id
    where pi.id = (storage.foldername(name))[1]::uuid and (
      public.is_event_owner(ev.event_id, auth.uid())
      or public.is_event_collaborator(ev.event_id, auth.uid(), 'editor')
    )
  )
);

create policy "payment_proofs_delete_event_editor"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and exists (
    select 1 from payment_installments pi
    join payment_plans pp on pp.id = pi.payment_plan_id
    join event_vendors ev on ev.id = pp.event_vendor_id
    where pi.id = (storage.foldername(name))[1]::uuid and (
      public.is_event_owner(ev.event_id, auth.uid())
      or public.is_event_collaborator(ev.event_id, auth.uid(), 'editor')
    )
  )
);
