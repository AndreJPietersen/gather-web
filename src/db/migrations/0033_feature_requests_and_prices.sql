CREATE TYPE "public"."feature_duration" AS ENUM('1_week', '1_month', '3_months');--> statement-breakpoint
CREATE TYPE "public"."feature_spot" AS ENUM('top', 'rotating');--> statement-breakpoint
CREATE TABLE "feature_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spot" "feature_spot" NOT NULL,
	"duration" "feature_duration" NOT NULL,
	"amount" numeric(12, 2),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_prices_amount_check" CHECK ("feature_prices"."amount" IS NULL OR "feature_prices"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "feature_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendor_feature_placements" ADD COLUMN "requested_by" uuid;--> statement-breakpoint
ALTER TABLE "vendor_feature_placements" ADD COLUMN "requested_spot" "feature_spot";--> statement-breakpoint
ALTER TABLE "vendor_feature_placements" ADD COLUMN "requested_duration" "feature_duration";--> statement-breakpoint
ALTER TABLE "vendor_feature_placements" ADD COLUMN "vendor_note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_prices_spot_duration_idx" ON "feature_prices" USING btree ("spot","duration");--> statement-breakpoint
ALTER TABLE "vendor_feature_placements" ADD CONSTRAINT "vendor_feature_placements_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "feature_prices_select_public" ON "feature_prices" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);