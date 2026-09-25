CREATE TABLE "app_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"featured_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_singleton_check" CHECK ("app_settings"."id")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_settings_select_public" ON "app_settings" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);