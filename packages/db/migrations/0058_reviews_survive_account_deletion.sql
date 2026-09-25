ALTER TABLE "vendor_reviews" DROP CONSTRAINT "vendor_reviews_event_vendor_id_event_vendors_id_fk";
--> statement-breakpoint
ALTER TABLE "vendor_reviews" ALTER COLUMN "event_vendor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_event_vendor_id_event_vendors_id_fk" FOREIGN KEY ("event_vendor_id") REFERENCES "public"."event_vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER POLICY "vendor_review_replies_insert_vendor_manager" ON "vendor_review_replies" TO authenticated WITH CHECK ("vendor_review_replies"."replied_by" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM vendor_reviews vr
        WHERE vr.id = "vendor_review_replies"."vendor_review_id" AND public.is_vendor_team_member(vr.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
      ));--> statement-breakpoint
ALTER POLICY "vendor_review_replies_update_vendor_manager" ON "vendor_review_replies" TO authenticated USING (EXISTS (
        SELECT 1 FROM vendor_reviews vr
        WHERE vr.id = "vendor_review_replies"."vendor_review_id" AND public.is_vendor_team_member(vr.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
      ));