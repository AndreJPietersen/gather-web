CREATE TYPE "public"."feature_placement_status" AS ENUM('pending', 'activated', 'cancelled');--> statement-breakpoint
CREATE TABLE "vendor_feature_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"status" "feature_placement_status" DEFAULT 'pending' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"position" integer,
	"fee_amount" numeric(12, 2),
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_feature_placements_dates_check" CHECK ("vendor_feature_placements"."ends_on" >= "vendor_feature_placements"."starts_on"),
	CONSTRAINT "vendor_feature_placements_position_check" CHECK ("vendor_feature_placements"."position" IS NULL OR "vendor_feature_placements"."position" >= 1)
);
--> statement-breakpoint
ALTER TABLE "vendor_feature_placements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendor_feature_placements" ADD CONSTRAINT "vendor_feature_placements_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_feature_placements" ADD CONSTRAINT "vendor_feature_placements_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_feature_placements_vendor_id_idx" ON "vendor_feature_placements" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_feature_placements_window_idx" ON "vendor_feature_placements" USING btree ("status","starts_on","ends_on");