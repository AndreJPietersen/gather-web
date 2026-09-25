CREATE TABLE "event_gallery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"caption" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_gallery_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_gallery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"caption" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_gallery_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_social_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_social_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_gallery_images" ADD CONSTRAINT "event_gallery_images_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_gallery_images" ADD CONSTRAINT "event_gallery_images_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_gallery_images" ADD CONSTRAINT "vendor_gallery_images_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_gallery_images" ADD CONSTRAINT "vendor_gallery_images_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_social_links" ADD CONSTRAINT "vendor_social_links_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_gallery_images_event_id_idx" ON "event_gallery_images" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "vendor_gallery_images_vendor_id_idx" ON "vendor_gallery_images" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_social_links_vendor_id_idx" ON "vendor_social_links" USING btree ("vendor_id");--> statement-breakpoint
CREATE POLICY "event_gallery_images_select_owner_or_collaborator" ON "event_gallery_images" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_event_owner("event_gallery_images"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_gallery_images"."event_id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "event_gallery_images_insert_owner_or_editor" ON "event_gallery_images" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_event_owner("event_gallery_images"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_gallery_images"."event_id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "event_gallery_images_delete_owner_or_editor" ON "event_gallery_images" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_event_owner("event_gallery_images"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_gallery_images"."event_id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "vendor_gallery_images_select_public" ON "vendor_gallery_images" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "vendor_gallery_images_insert_owner_or_manager_if_verified" ON "vendor_gallery_images" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
        public.is_vendor_team_member("vendor_gallery_images"."vendor_id", (select auth.uid()), ARRAY['owner', 'manager'])
        AND EXISTS (SELECT 1 FROM vendors v WHERE v.id = "vendor_gallery_images"."vendor_id" AND v.verification_status = 'verified')
      );--> statement-breakpoint
CREATE POLICY "vendor_gallery_images_delete_owner_or_manager" ON "vendor_gallery_images" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_vendor_team_member("vendor_gallery_images"."vendor_id", (select auth.uid()), ARRAY['owner', 'manager']));--> statement-breakpoint
CREATE POLICY "vendor_social_links_select_public" ON "vendor_social_links" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "vendor_social_links_insert_owner_or_manager_if_verified" ON "vendor_social_links" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
        public.is_vendor_team_member("vendor_social_links"."vendor_id", (select auth.uid()), ARRAY['owner', 'manager'])
        AND EXISTS (SELECT 1 FROM vendors v WHERE v.id = "vendor_social_links"."vendor_id" AND v.verification_status = 'verified')
      );--> statement-breakpoint
CREATE POLICY "vendor_social_links_delete_owner_or_manager" ON "vendor_social_links" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_vendor_team_member("vendor_social_links"."vendor_id", (select auth.uid()), ARRAY['owner', 'manager']));