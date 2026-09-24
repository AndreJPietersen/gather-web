CREATE TABLE "vendor_booking_notes" (
	"event_vendor_id" uuid PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_booking_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD COLUMN "suggested_by" uuid;--> statement-breakpoint
ALTER TABLE "vendor_booking_notes" ADD CONSTRAINT "vendor_booking_notes_event_vendor_id_event_vendors_id_fk" FOREIGN KEY ("event_vendor_id") REFERENCES "public"."event_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_booking_notes" ADD CONSTRAINT "vendor_booking_notes_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_suggested_by_profiles_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "vendor_quotes_delete_draft" ON "vendor_quotes" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("vendor_quotes"."status" = 'draft' AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_quotes"."event_vendor_id" AND (
          public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
          OR ("vendor_quotes"."suggested_by" = (select auth.uid()) AND public.is_vendor_team_member(ev.vendor_id, (select auth.uid())))
        )
      ));--> statement-breakpoint
CREATE POLICY "vendor_booking_notes_select_team" ON "vendor_booking_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_booking_notes"."event_vendor_id" AND public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "vendor_booking_notes_insert_team" ON "vendor_booking_notes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("vendor_booking_notes"."updated_by" = (select auth.uid()) AND EXISTS (SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_booking_notes"."event_vendor_id" AND public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))));--> statement-breakpoint
CREATE POLICY "vendor_booking_notes_update_team" ON "vendor_booking_notes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_booking_notes"."event_vendor_id" AND public.is_vendor_team_member(ev.vendor_id, (select auth.uid())))) WITH CHECK ("vendor_booking_notes"."updated_by" = (select auth.uid()));--> statement-breakpoint
ALTER POLICY "payment_installments_select_event_side_or_vendor_side" ON "payment_installments" TO authenticated USING (EXISTS (
        SELECT 1 FROM payment_plans pp JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pp.id = "payment_installments"."payment_plan_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
        )
      ));--> statement-breakpoint
ALTER POLICY "payment_plans_select_event_side_or_vendor_side" ON "payment_plans" TO authenticated USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "payment_plans"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
        )
      ));--> statement-breakpoint
ALTER POLICY "payment_reminders_select_event_side_or_vendor_side" ON "payment_reminders" TO authenticated USING (EXISTS (
        SELECT 1 FROM payment_installments pi
        JOIN payment_plans pp ON pp.id = pi.payment_plan_id
        JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pi.id = "payment_reminders"."payment_installment_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
        )
      ));--> statement-breakpoint
ALTER POLICY "vendor_gallery_images_insert_owner_or_manager_if_verified" ON "vendor_gallery_images" TO authenticated WITH CHECK (
        public.is_vendor_team_member("vendor_gallery_images"."vendor_id", (select auth.uid()), ARRAY['owner', 'manager', 'staff'])
        AND public.is_vendor_verified("vendor_gallery_images"."vendor_id")
      );--> statement-breakpoint
ALTER POLICY "vendor_quotes_select_event_side_or_vendor_side" ON "vendor_quotes" TO authenticated USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_quotes"."event_vendor_id" AND (
          ((public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid())))
            AND "vendor_quotes"."status" <> 'draft')
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
          OR ("vendor_quotes"."status" = 'draft' AND "vendor_quotes"."suggested_by" = (select auth.uid())
            AND public.is_vendor_team_member(ev.vendor_id, (select auth.uid())))
        )
      ));--> statement-breakpoint
ALTER POLICY "vendor_quotes_insert_vendor_manager" ON "vendor_quotes" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_quotes"."event_vendor_id" AND (
          public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
          OR (public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['staff'])
            AND "vendor_quotes"."status" = 'draft' AND "vendor_quotes"."suggested_by" = (select auth.uid()))
        )
      ));