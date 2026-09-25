CREATE TABLE "event_vendor_chat_reads" (
	"event_vendor_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_vendor_chat_reads_event_vendor_id_user_id_pk" PRIMARY KEY("event_vendor_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_vendor_chat_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_vendor_chat_reads" ADD CONSTRAINT "event_vendor_chat_reads_event_vendor_id_event_vendors_id_fk" FOREIGN KEY ("event_vendor_id") REFERENCES "public"."event_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_vendor_chat_reads" ADD CONSTRAINT "event_vendor_chat_reads_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "event_vendor_chat_reads_select_own" ON "event_vendor_chat_reads" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("event_vendor_chat_reads"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "event_vendor_chat_reads_upsert_own" ON "event_vendor_chat_reads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("event_vendor_chat_reads"."user_id" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "event_vendor_chat_reads"."event_vendor_id" AND (
          public.is_event_owner(ev.event_id, (select auth.uid()))
          OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
          OR public.is_vendor_team_member(ev.vendor_id, (select auth.uid()))
        )
      ));--> statement-breakpoint
CREATE POLICY "event_vendor_chat_reads_update_own" ON "event_vendor_chat_reads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("event_vendor_chat_reads"."user_id" = (select auth.uid()));