CREATE TABLE "event_mood_board_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_mood_board_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_mood_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"tagline" text,
	"palette" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_mood_boards_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "event_mood_boards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_mood_board_photos" ADD CONSTRAINT "event_mood_board_photos_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_mood_board_photos" ADD CONSTRAINT "event_mood_board_photos_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_mood_boards" ADD CONSTRAINT "event_mood_boards_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_mood_board_photos_event_id_idx" ON "event_mood_board_photos" USING btree ("event_id");--> statement-breakpoint
CREATE POLICY "event_mood_board_photos_select_owner_or_collaborator" ON "event_mood_board_photos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_event_owner("event_mood_board_photos"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_mood_board_photos"."event_id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "event_mood_board_photos_insert_owner_or_editor" ON "event_mood_board_photos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_event_owner("event_mood_board_photos"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_mood_board_photos"."event_id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "event_mood_board_photos_update_owner_or_editor" ON "event_mood_board_photos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_event_owner("event_mood_board_photos"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_mood_board_photos"."event_id", (select auth.uid()), 'editor')) WITH CHECK (public.is_event_owner("event_mood_board_photos"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_mood_board_photos"."event_id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "event_mood_board_photos_delete_owner_or_editor" ON "event_mood_board_photos" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_event_owner("event_mood_board_photos"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_mood_board_photos"."event_id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "event_mood_boards_select_owner_or_collaborator" ON "event_mood_boards" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_event_owner("event_mood_boards"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_mood_boards"."event_id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "event_mood_boards_insert_owner_or_editor" ON "event_mood_boards" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_event_owner("event_mood_boards"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_mood_boards"."event_id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "event_mood_boards_update_owner_or_editor" ON "event_mood_boards" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_event_owner("event_mood_boards"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_mood_boards"."event_id", (select auth.uid()), 'editor')) WITH CHECK (public.is_event_owner("event_mood_boards"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_mood_boards"."event_id", (select auth.uid()), 'editor'));