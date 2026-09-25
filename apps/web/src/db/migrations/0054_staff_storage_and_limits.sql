-- Staff permissions, the parts Drizzle doesn't model (storage policies,
-- rate-limit registration). See 0052/0053 for the table policies.

-- Staff may upload to the business gallery (the vendor_gallery_images row
-- policy already allows it); only Owner/Manager may still delete files.
DROP POLICY IF EXISTS "vendor_gallery_insert_owner_or_manager_if_verified" ON storage.objects;
CREATE POLICY "vendor_gallery_insert_owner_or_manager_if_verified"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-gallery'
  AND public.is_vendor_team_member((storage.foldername(name))[1]::uuid, auth.uid(), array['owner', 'manager', 'staff'])
  AND public.is_vendor_verified((storage.foldername(name))[1]::uuid)
);

-- Proof-of-payment files are money information: vendor side Owner/Manager
-- only, matching payment_plans / payment_installments.
DROP POLICY IF EXISTS "payment_proofs_select_event_side_or_vendor_side" ON storage.objects;
CREATE POLICY "payment_proofs_select_event_side_or_vendor_side"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.payment_installments pi
    JOIN public.payment_plans pp ON pp.id = pi.payment_plan_id
    JOIN public.event_vendors ev ON ev.id = pp.event_vendor_id
    WHERE pi.id = (storage.foldername(name))[1]::uuid AND (
      public.is_event_owner(ev.event_id, auth.uid())
      OR public.is_event_collaborator(ev.event_id, auth.uid())
      OR public.is_vendor_team_member(ev.vendor_id, auth.uid(), array['owner', 'manager'])
    )
  )
);

-- Team notes: writable columns only, no client delete, and an hourly limit
-- like every other user-written table.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.vendor_booking_notes FROM anon;
REVOKE DELETE, TRUNCATE ON public.vendor_booking_notes FROM authenticated;
REVOKE INSERT, UPDATE ON public.vendor_booking_notes FROM authenticated;
GRANT INSERT (event_vendor_id, body, updated_by, updated_at) ON public.vendor_booking_notes TO authenticated;
GRANT UPDATE (body, updated_by, updated_at, event_vendor_id) ON public.vendor_booking_notes TO authenticated;

-- vendor_quotes gained suggested_by; a quote's booking must never change.
REVOKE INSERT ON public.vendor_quotes FROM authenticated;
GRANT INSERT (event_vendor_id, quote_number, amount, description, valid_until, status, created_by_vendor, document_url, suggested_by)
  ON public.vendor_quotes TO authenticated;

INSERT INTO public.write_rate_limits (table_name, label, max_per_hour) VALUES ('vendor_booking_notes', 'Booking notes added', 200)
ON CONFLICT (table_name) DO NOTHING;
DROP TRIGGER IF EXISTS enforce_write_rate_limit ON public.vendor_booking_notes;
CREATE TRIGGER enforce_write_rate_limit BEFORE INSERT ON public.vendor_booking_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_write_rate_limit();
