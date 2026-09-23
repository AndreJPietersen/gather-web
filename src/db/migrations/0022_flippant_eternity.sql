CREATE POLICY "payment_reminders_insert_self" ON "payment_reminders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("payment_reminders"."contact_user_id" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM payment_installments pi
        JOIN payment_plans pp ON pp.id = pi.payment_plan_id
        JOIN event_vendors ev ON ev.id = pp.event_vendor_id
        WHERE pi.id = "payment_reminders"."payment_installment_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor')
        )
      ));