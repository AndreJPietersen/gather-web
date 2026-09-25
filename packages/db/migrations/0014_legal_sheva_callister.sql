CREATE TABLE "event_vendor_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_vendor_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text,
	"storage_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_vendor_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_vendor_messages" ADD CONSTRAINT "event_vendor_messages_event_vendor_id_event_vendors_id_fk" FOREIGN KEY ("event_vendor_id") REFERENCES "public"."event_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_vendor_messages" ADD CONSTRAINT "event_vendor_messages_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_vendor_messages_event_vendor_id_idx" ON "event_vendor_messages" USING btree ("event_vendor_id");--> statement-breakpoint
CREATE POLICY "event_vendor_messages_select_event_side_or_vendor_side" ON "event_vendor_messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "event_vendor_messages"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))
        )
      ));--> statement-breakpoint
CREATE POLICY "event_vendor_messages_insert_event_editor_or_vendor_member" ON "event_vendor_messages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("event_vendor_messages"."sender_id" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "event_vendor_messages"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()), 'editor')
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))
        )
      ));