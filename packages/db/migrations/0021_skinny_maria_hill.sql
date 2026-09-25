CREATE TYPE "public"."support_case_category" AS ENUM('payments_billing', 'vendor_booking', 'event_setup', 'account_verification', 'app_bug', 'other');--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "category" "support_case_category";--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "attachment_path" text;--> statement-breakpoint
CREATE POLICY "support_cases_insert_self" ON "support_cases" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("support_cases"."created_by" = (select auth.uid()) AND "support_cases"."requester_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "support_cases_select_own" ON "support_cases" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("support_cases"."requester_id" = (select auth.uid()));