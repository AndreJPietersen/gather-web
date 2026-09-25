CREATE TABLE "user_write_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"table_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_write_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "write_rate_limits" (
	"table_name" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"max_per_hour" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "write_rate_limits_positive_check" CHECK ("write_rate_limits"."max_per_hour" >= 1)
);
--> statement-breakpoint
ALTER TABLE "write_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "max_owned_businesses" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "watch_listing_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "watch_listing_min" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "watch_team_min" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "watch_claim_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "watch_claim_min" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "watch_invite_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "watch_invite_min" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "watch_contact_min" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
CREATE INDEX "user_write_log_lookup_idx" ON "user_write_log" USING btree ("user_id","table_name","created_at");--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_limits_positive_check" CHECK ("app_settings"."max_owned_businesses" >= 1 AND "app_settings"."watch_listing_days" >= 1 AND "app_settings"."watch_listing_min" >= 1 AND "app_settings"."watch_team_min" >= 1 AND "app_settings"."watch_claim_days" >= 1 AND "app_settings"."watch_claim_min" >= 1 AND "app_settings"."watch_invite_days" >= 1 AND "app_settings"."watch_invite_min" >= 1 AND "app_settings"."watch_contact_min" >= 2);