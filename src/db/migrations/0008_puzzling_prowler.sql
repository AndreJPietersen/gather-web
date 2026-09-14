CREATE TYPE "public"."support_case_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."support_case_status" AS ENUM('open', 'pending', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_table" text NOT NULL,
	"target_id" uuid,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "support_case_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_case_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "support_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"status" "support_case_status" DEFAULT 'open' NOT NULL,
	"priority" "support_case_priority" DEFAULT 'normal' NOT NULL,
	"requester_id" uuid,
	"related_event_id" uuid,
	"related_vendor_id" uuid,
	"assigned_admin_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "support_cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_profiles_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_comments" ADD CONSTRAINT "support_case_comments_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_comments" ADD CONSTRAINT "support_case_comments_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_requester_id_profiles_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_related_event_id_events_id_fk" FOREIGN KEY ("related_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_related_vendor_id_vendors_id_fk" FOREIGN KEY ("related_vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_assigned_admin_id_profiles_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_log_admin_id_idx" ON "admin_audit_log" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_idx" ON "admin_audit_log" USING btree ("target_table","target_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "support_case_comments_case_id_idx" ON "support_case_comments" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "support_cases_status_idx" ON "support_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_cases_requester_id_idx" ON "support_cases" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "support_cases_related_event_id_idx" ON "support_cases" USING btree ("related_event_id");--> statement-breakpoint
CREATE INDEX "support_cases_related_vendor_id_idx" ON "support_cases" USING btree ("related_vendor_id");--> statement-breakpoint
CREATE INDEX "support_cases_assigned_admin_id_idx" ON "support_cases" USING btree ("assigned_admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_claim_requests_one_approved_per_vendor" ON "vendor_claim_requests" USING btree ("vendor_id") WHERE status = 'approved';