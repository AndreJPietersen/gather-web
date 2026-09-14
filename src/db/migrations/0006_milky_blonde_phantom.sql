CREATE INDEX "vendor_team_invites_vendor_id_idx" ON "vendor_team_invites" USING btree ("vendor_id");--> statement-breakpoint
CREATE POLICY "vendor_team_invites_select_team_or_invitee" ON "vendor_team_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_vendor_team_member("vendor_team_invites"."vendor_id", (select auth.uid())) OR public.invite_email_matches_current_user("vendor_team_invites"."invited_email", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "vendor_team_invites_insert_owner" ON "vendor_team_invites" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_vendor_team_member("vendor_team_invites"."vendor_id", (select auth.uid()), ARRAY['owner']));--> statement-breakpoint
CREATE POLICY "vendor_team_invites_update_owner_or_invitee" ON "vendor_team_invites" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_vendor_team_member("vendor_team_invites"."vendor_id", (select auth.uid()), ARRAY['owner']) OR public.invite_email_matches_current_user("vendor_team_invites"."invited_email", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "vendor_team_members_insert_self_on_accepted_invite" ON "vendor_team_members" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("vendor_team_members"."user_id" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM vendor_team_invites vti
        WHERE vti.vendor_id = "vendor_team_members"."vendor_id"
          AND vti.role = "vendor_team_members"."role"
          AND vti.status = 'accepted'
          AND public.invite_email_matches_current_user(vti.invited_email, (select auth.uid()))
      ));