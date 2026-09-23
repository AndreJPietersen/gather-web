CREATE POLICY "payment_plans_delete_event_editor" ON "payment_plans" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "payment_plans"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor')
        )
      ));