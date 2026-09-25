ALTER POLICY "vendor_gallery_images_insert_owner_or_manager_if_verified" ON "vendor_gallery_images" TO authenticated WITH CHECK (
        public.is_vendor_team_member("vendor_gallery_images"."vendor_id", (select auth.uid()), ARRAY['owner', 'manager'])
        AND public.is_vendor_verified("vendor_gallery_images"."vendor_id")
      );--> statement-breakpoint
ALTER POLICY "vendor_social_links_insert_owner_or_manager_if_verified" ON "vendor_social_links" TO authenticated WITH CHECK (
        public.is_vendor_team_member("vendor_social_links"."vendor_id", (select auth.uid()), ARRAY['owner', 'manager'])
        AND public.is_vendor_verified("vendor_social_links"."vendor_id")
      );