ALTER POLICY "vendor_quotes_insert_vendor_manager" ON "vendor_quotes" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_quotes"."event_vendor_id" AND (
          (public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
            AND "vendor_quotes"."status" IN ('sent', 'draft'))
          OR (public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['staff'])
            AND "vendor_quotes"."status" = 'draft' AND "vendor_quotes"."suggested_by" = (select auth.uid()))
        )
      ));--> statement-breakpoint
ALTER POLICY "vendor_quotes_update_event_editor_or_vendor_manager" ON "vendor_quotes" TO authenticated USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_quotes"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor')
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
        )
      )) WITH CHECK (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_quotes"."event_vendor_id" AND (
          ((public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor'))
            AND "vendor_quotes"."status" IN ('accepted', 'declined'))
          OR (public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
            AND "vendor_quotes"."status" IN ('sent', 'draft'))
        )
      ));