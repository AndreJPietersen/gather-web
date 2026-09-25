CREATE INDEX "payment_installments_payment_plan_id_idx" ON "payment_installments" USING btree ("payment_plan_id");--> statement-breakpoint
CREATE INDEX "payment_plans_event_vendor_id_idx" ON "payment_plans" USING btree ("event_vendor_id");--> statement-breakpoint
CREATE INDEX "payment_reminders_payment_installment_id_idx" ON "payment_reminders" USING btree ("payment_installment_id");--> statement-breakpoint
CREATE INDEX "vendor_quotes_event_vendor_id_idx" ON "vendor_quotes" USING btree ("event_vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_quotes_one_accepted_per_event_vendor" ON "vendor_quotes" USING btree ("event_vendor_id") WHERE "vendor_quotes"."status" = 'accepted';--> statement-breakpoint
CREATE POLICY "payment_installments_select_event_side_or_vendor_side" ON "payment_installments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM payment_plans pp JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pp.id = "payment_installments"."payment_plan_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))
        )
      ));--> statement-breakpoint
CREATE POLICY "payment_installments_insert_event_editor" ON "payment_installments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM payment_plans pp JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pp.id = "payment_installments"."payment_plan_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor')
        )
      ));--> statement-breakpoint
CREATE POLICY "payment_installments_update_event_editor" ON "payment_installments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM payment_plans pp JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pp.id = "payment_installments"."payment_plan_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor')
        )
      ));--> statement-breakpoint
CREATE POLICY "payment_plans_select_event_side_or_vendor_side" ON "payment_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "payment_plans"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))
        )
      ));--> statement-breakpoint
CREATE POLICY "payment_plans_insert_event_editor" ON "payment_plans" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "payment_plans"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor')
        )
      ));--> statement-breakpoint
CREATE POLICY "payment_plans_update_event_editor" ON "payment_plans" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "payment_plans"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor')
        )
      ));--> statement-breakpoint
CREATE POLICY "payment_reminders_select_event_side_or_vendor_side" ON "payment_reminders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM payment_installments pi
        JOIN payment_plans pp ON pp.id = pi.payment_plan_id
        JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pi.id = "payment_reminders"."payment_installment_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))
        )
      ));--> statement-breakpoint
CREATE POLICY "vendor_quotes_select_event_side_or_vendor_side" ON "vendor_quotes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_quotes"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))
        )
      ));--> statement-breakpoint
CREATE POLICY "vendor_quotes_insert_vendor_manager" ON "vendor_quotes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_quotes"."event_vendor_id"
          AND public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
      ));--> statement-breakpoint
CREATE POLICY "vendor_quotes_update_event_editor_or_vendor_manager" ON "vendor_quotes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_quotes"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor')
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
        )
      ));