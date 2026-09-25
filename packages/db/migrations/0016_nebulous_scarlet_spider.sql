CREATE POLICY "event_collaborators_select_vendor_side" ON "event_collaborators" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.event_id = "event_collaborators"."event_id" AND public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))
      ));--> statement-breakpoint
CREATE POLICY "vendor_team_members_select_event_side" ON "vendor_team_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.vendor_id = "vendor_team_members"."vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
        )
      ));