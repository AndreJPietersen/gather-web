ALTER TABLE "vendor_reviews" ADD COLUMN "vendor_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_reviews_vendor_id_idx" ON "vendor_reviews" USING btree ("vendor_id");--> statement-breakpoint
ALTER POLICY "vendor_reviews_insert_self" ON "vendor_reviews" TO authenticated WITH CHECK ("vendor_reviews"."reviewer_id" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_reviews"."event_vendor_id" AND ev.vendor_id = "vendor_reviews"."vendor_id" AND ev.status = 'contracted' AND (
          public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
        )
      ));--> statement-breakpoint
ALTER POLICY "vendor_reviews_update_own" ON "vendor_reviews" TO authenticated USING ("vendor_reviews"."reviewer_id" = (select auth.uid())) WITH CHECK ("vendor_reviews"."reviewer_id" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_reviews"."event_vendor_id" AND ev.vendor_id = "vendor_reviews"."vendor_id" AND ev.status = 'contracted' AND (
          public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
        )
      ));