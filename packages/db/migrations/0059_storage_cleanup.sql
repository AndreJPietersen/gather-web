ALTER TABLE "app_settings" ADD COLUMN "storage_cleanup_min_age_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
-- Files in storage that no row points at any more (left behind when an event,
-- photo, message or account is deleted: deleting a row never deletes its
-- file). Returned to the storage cleanup job, which removes them through the
-- Storage API — deleting storage.objects rows directly would leave the file
-- itself behind. Only files older than p_min_age_minutes count, so a file
-- uploaded a moment before its row is saved is never caught.
CREATE FUNCTION public.orphaned_storage_objects(p_min_age_minutes integer)
RETURNS TABLE (bucket_id text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT o.bucket_id, o.name
  FROM storage.objects o
  WHERE o.created_at < now() - make_interval(mins => p_min_age_minutes)
    AND o.name NOT LIKE '%.emptyFolderPlaceholder'
    AND CASE o.bucket_id
      WHEN 'event-gallery' THEN NOT EXISTS (SELECT 1 FROM public.event_gallery_images t WHERE t.storage_path = o.name)
      WHEN 'event-mood-board' THEN NOT EXISTS (SELECT 1 FROM public.event_mood_board_photos t WHERE t.storage_path = o.name)
      WHEN 'event-vendor-chat' THEN NOT EXISTS (SELECT 1 FROM public.event_vendor_messages t WHERE t.storage_path = o.name)
      WHEN 'payment-proofs' THEN NOT EXISTS (SELECT 1 FROM public.payment_installments t WHERE t.proof_of_payment_path = o.name)
      WHEN 'support-case-attachments' THEN NOT EXISTS (SELECT 1 FROM public.support_cases t WHERE t.attachment_path = o.name)
      WHEN 'vendor-gallery' THEN NOT EXISTS (SELECT 1 FROM public.vendor_gallery_images t WHERE t.storage_path = o.name)
      WHEN 'vendor-logos' THEN NOT EXISTS (SELECT 1 FROM public.vendors t WHERE t.logo_path = o.name)
      ELSE false -- a bucket this function doesn't know about is never touched
    END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.orphaned_storage_objects(integer) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.orphaned_storage_objects(integer) TO service_role;
