CREATE TABLE "task_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_task_id" uuid NOT NULL,
	"contact_user_id" uuid,
	"remind_at" timestamp with time zone NOT NULL,
	"method" "reminder_method" DEFAULT 'email' NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_event_task_id_event_tasks_id_fk" FOREIGN KEY ("event_task_id") REFERENCES "public"."event_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_contact_user_id_profiles_id_fk" FOREIGN KEY ("contact_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_reminders_event_task_id_idx" ON "task_reminders" USING btree ("event_task_id");--> statement-breakpoint
CREATE POLICY "task_reminders_select_own" ON "task_reminders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("task_reminders"."contact_user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "task_reminders_insert_self" ON "task_reminders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("task_reminders"."contact_user_id" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM event_tasks et
        WHERE et.id = "task_reminders"."event_task_id" AND (
          public.is_event_owner(et.event_id, (select auth.uid())) OR public.is_event_collaborator(et.event_id, (select auth.uid()))
        )
      ));