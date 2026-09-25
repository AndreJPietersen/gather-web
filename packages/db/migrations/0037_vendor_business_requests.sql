CREATE TYPE "public"."vendor_business_request_status" AS ENUM('pending', 'approved', 'rejected', 'used');--> statement-breakpoint
CREATE TABLE "vendor_business_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"business_name" text NOT NULL,
	"primary_category" text,
	"needs_extra_slot" boolean DEFAULT false NOT NULL,
	"needs_duplicate_category" boolean DEFAULT false NOT NULL,
	"reason" text,
	"status" "vendor_business_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"used_vendor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_business_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendor_business_requests" ADD CONSTRAINT "vendor_business_requests_requester_id_profiles_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_business_requests" ADD CONSTRAINT "vendor_business_requests_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_business_requests" ADD CONSTRAINT "vendor_business_requests_used_vendor_id_vendors_id_fk" FOREIGN KEY ("used_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_business_requests_requester_id_idx" ON "vendor_business_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "vendor_business_requests_status_idx" ON "vendor_business_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_business_requests_one_pending_per_user" ON "vendor_business_requests" USING btree ("requester_id") WHERE status = 'pending';--> statement-breakpoint
DROP POLICY "vendor_team_members_insert_self_on_vendor_creation" ON "vendor_team_members" CASCADE;--> statement-breakpoint
CREATE POLICY "vendor_business_requests_select_own" ON "vendor_business_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("vendor_business_requests"."requester_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "vendor_business_requests_insert_own_pending" ON "vendor_business_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("vendor_business_requests"."requester_id" = (select auth.uid()) AND "vendor_business_requests"."status" = 'pending');