ALTER POLICY "event_vendor_messages_insert_event_editor_or_vendor_member" ON "event_vendor_messages" TO authenticated WITH CHECK ("event_vendor_messages"."sender_id" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "event_vendor_messages"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor')
          OR (public.is_vendor_team_member(ev.vendor_id, (select auth.uid())) AND public.is_vendor_verified(ev.vendor_id))
        )
      ));