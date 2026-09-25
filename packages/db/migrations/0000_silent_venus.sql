CREATE TYPE "public"."claim_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."collaborator_permission" AS ENUM('editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_vendor_status" AS ENUM('interested', 'shortlisted', 'contracted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."event_visibility" AS ENUM('public', 'private', 'invite_only');--> statement-breakpoint
CREATE TYPE "public"."installment_status" AS ENUM('pending', 'paid', 'late', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('invited', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."payment_plan_status" AS ENUM('draft', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reminder_method" AS ENUM('email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('attending', 'declined', 'maybe', 'no_response');--> statement-breakpoint
CREATE TYPE "public"."vendor_quote_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."vendor_role" AS ENUM('owner', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "public"."vendor_verification_status" AS ENUM('unclaimed', 'claim_pending', 'verified');--> statement-breakpoint
CREATE TABLE "event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"contact_user_id" uuid,
	"name" text,
	"email" text,
	"phone" text,
	"rsvp_status" "rsvp_status" DEFAULT 'no_response' NOT NULL,
	"guest_count" integer DEFAULT 1 NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_attendees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission_level" "collaborator_permission" DEFAULT 'viewer' NOT NULL,
	"status" "invitation_status" DEFAULT 'invited' NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_collaborators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_date" date,
	"completed" boolean DEFAULT false NOT NULL,
	"priority" text,
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"status" "event_vendor_status" DEFAULT 'interested' NOT NULL,
	"vendor_type" text,
	"notes" text,
	"confirmed" boolean DEFAULT false NOT NULL,
	"amount" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_vendors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"event_type" text,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"visibility" "event_visibility" DEFAULT 'private' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"location" text,
	"description" text,
	"capacity" integer,
	"cover_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_plan_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "installment_status" DEFAULT 'pending' NOT NULL,
	"paid_on" date,
	"payment_gateway" text,
	"gateway_transaction_id" text,
	"gateway_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_installments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_vendor_id" uuid NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"deposit_amount" numeric(12, 2),
	"deposit_due_date" date,
	"status" "payment_plan_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_installment_id" uuid NOT NULL,
	"contact_user_id" uuid,
	"remind_at" timestamp with time zone NOT NULL,
	"method" "reminder_method" DEFAULT 'email' NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_claim_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"notes" text,
	"status" "claim_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_claim_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_vendor_id" uuid NOT NULL,
	"quote_number" text,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"valid_until" date,
	"status" "vendor_quote_status" DEFAULT 'draft' NOT NULL,
	"created_by_vendor" boolean DEFAULT true NOT NULL,
	"document_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "vendor_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"invited_email" text NOT NULL,
	"role" "vendor_role" DEFAULT 'staff' NOT NULL,
	"status" "invitation_status" DEFAULT 'invited' NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_team_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "vendor_role" DEFAULT 'staff' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"primary_category" text,
	"description" text,
	"phone" text,
	"website" text,
	"verification_status" "vendor_verification_status" DEFAULT 'unclaimed' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_contact_user_id_profiles_id_fk" FOREIGN KEY ("contact_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD CONSTRAINT "event_collaborators_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD CONSTRAINT "event_collaborators_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD CONSTRAINT "event_collaborators_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tasks" ADD CONSTRAINT "event_tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tasks" ADD CONSTRAINT "event_tasks_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_vendors" ADD CONSTRAINT "event_vendors_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_vendors" ADD CONSTRAINT "event_vendors_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_installments" ADD CONSTRAINT "payment_installments_payment_plan_id_payment_plans_id_fk" FOREIGN KEY ("payment_plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_event_vendor_id_event_vendors_id_fk" FOREIGN KEY ("event_vendor_id") REFERENCES "public"."event_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_payment_installment_id_payment_installments_id_fk" FOREIGN KEY ("payment_installment_id") REFERENCES "public"."payment_installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_contact_user_id_profiles_id_fk" FOREIGN KEY ("contact_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_claim_requests" ADD CONSTRAINT "vendor_claim_requests_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_claim_requests" ADD CONSTRAINT "vendor_claim_requests_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_claim_requests" ADD CONSTRAINT "vendor_claim_requests_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_event_vendor_id_event_vendors_id_fk" FOREIGN KEY ("event_vendor_id") REFERENCES "public"."event_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_services" ADD CONSTRAINT "vendor_services_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_team_invites" ADD CONSTRAINT "vendor_team_invites_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_team_invites" ADD CONSTRAINT "vendor_team_invites_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_team_members" ADD CONSTRAINT "vendor_team_members_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_team_members" ADD CONSTRAINT "vendor_team_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_collaborators_event_id_idx" ON "event_collaborators" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_collaborators_user_id_idx" ON "event_collaborators" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_vendors_event_id_idx" ON "event_vendors" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_vendors_vendor_id_idx" ON "event_vendors" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "events_owner_id_idx" ON "events" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "vendor_team_members_vendor_id_idx" ON "vendor_team_members" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_team_members_user_id_idx" ON "vendor_team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vendors_created_by_idx" ON "vendors" USING btree ("created_by");--> statement-breakpoint
CREATE POLICY "event_collaborators_select_self_or_event_owner" ON "event_collaborators" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("event_collaborators"."user_id" = (select auth.uid()) OR public.is_event_owner("event_collaborators"."event_id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "event_collaborators_insert_owner_or_editor" ON "event_collaborators" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_event_owner("event_collaborators"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_collaborators"."event_id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "event_collaborators_update_self_or_event_owner" ON "event_collaborators" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("event_collaborators"."user_id" = (select auth.uid()) OR public.is_event_owner("event_collaborators"."event_id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "event_collaborators_delete_event_owner" ON "event_collaborators" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_event_owner("event_collaborators"."event_id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "event_vendors_select_event_side_or_vendor_side" ON "event_vendors" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_event_owner("event_vendors"."event_id", (select auth.uid()))
        OR public.is_event_collaborator("event_vendors"."event_id", (select auth.uid()))
        OR public.is_vendor_team_member("event_vendors"."vendor_id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "event_vendors_insert_event_editor" ON "event_vendors" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_event_owner("event_vendors"."event_id", (select auth.uid())) OR public.is_event_collaborator("event_vendors"."event_id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "event_vendors_update_event_editor_or_vendor_manager" ON "event_vendors" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_event_owner("event_vendors"."event_id", (select auth.uid()))
        OR public.is_event_collaborator("event_vendors"."event_id", (select auth.uid()), 'editor')
        OR public.is_vendor_team_member("event_vendors"."vendor_id", (select auth.uid()), ARRAY['owner', 'manager']));--> statement-breakpoint
CREATE POLICY "events_select_public" ON "events" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("events"."status" = 'published' AND "events"."visibility" = 'public');--> statement-breakpoint
CREATE POLICY "events_select_owner_or_collaborator" ON "events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("events"."owner_id" = (select auth.uid()) OR public.is_event_collaborator("events"."id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "events_insert_own" ON "events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("events"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "events_update_owner_or_editor" ON "events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("events"."owner_id" = (select auth.uid()) OR public.is_event_collaborator("events"."id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "events_delete_owner" ON "events" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("events"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_select_all_authenticated" ON "profiles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "vendor_team_members_select_own_team" ON "vendor_team_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("vendor_team_members"."user_id" = (select auth.uid()) OR public.is_vendor_team_member("vendor_team_members"."vendor_id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "vendor_team_members_insert_self_on_vendor_creation" ON "vendor_team_members" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("vendor_team_members"."user_id" = (select auth.uid()) AND "vendor_team_members"."role" = 'owner' AND public.is_vendor_creator("vendor_team_members"."vendor_id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "vendor_team_members_insert_by_existing_owner" ON "vendor_team_members" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_vendor_team_member("vendor_team_members"."vendor_id", (select auth.uid()), ARRAY['owner']));--> statement-breakpoint
CREATE POLICY "vendor_team_members_update_by_owner" ON "vendor_team_members" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_vendor_team_member("vendor_team_members"."vendor_id", (select auth.uid()), ARRAY['owner']));--> statement-breakpoint
CREATE POLICY "vendor_team_members_delete_by_owner" ON "vendor_team_members" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_vendor_team_member("vendor_team_members"."vendor_id", (select auth.uid()), ARRAY['owner']));--> statement-breakpoint
CREATE POLICY "vendors_select_public_or_own" ON "vendors" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("vendors"."verification_status" = 'verified' OR "vendors"."created_by" = (select auth.uid()) OR public.is_vendor_team_member("vendors"."id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "vendors_insert_authenticated" ON "vendors" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("vendors"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "vendors_update_creator_stub_or_owner_manager" ON "vendors" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (("vendors"."verification_status" = 'unclaimed' AND "vendors"."created_by" = (select auth.uid())) OR public.is_vendor_team_member("vendors"."id", (select auth.uid()), ARRAY['owner', 'manager']));