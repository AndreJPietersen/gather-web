CREATE POLICY "events_select_vendor_side" ON "events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.event_id = "events"."id" AND public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))
      ));