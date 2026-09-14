CREATE TABLE "notification_preferences" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"email_reminders" boolean DEFAULT true NOT NULL,
	"sms_reminders" boolean DEFAULT false NOT NULL,
	"push_reminders" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "notification_preferences_select_own" ON "notification_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("notification_preferences"."profile_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notification_preferences_insert_own" ON "notification_preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("notification_preferences"."profile_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "notification_preferences_update_own" ON "notification_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("notification_preferences"."profile_id" = (select auth.uid()));