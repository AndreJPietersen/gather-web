CREATE TABLE "budget_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"category_id" uuid,
	"label" text NOT NULL,
	"budgeted_amount" numeric(12, 2) NOT NULL,
	"event_vendor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "budget_total" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "budget_warning_percent" integer;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD COLUMN "budget_item_id" uuid;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_event_vendor_id_event_vendors_id_fk" FOREIGN KEY ("event_vendor_id") REFERENCES "public"."event_vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_items_event_id_idx" ON "budget_items" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_budget_item_id_budget_items_id_fk" FOREIGN KEY ("budget_item_id") REFERENCES "public"."budget_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_plans_budget_item_id_idx" ON "payment_plans" USING btree ("budget_item_id");--> statement-breakpoint
CREATE POLICY "budget_items_select_owner_or_collaborator" ON "budget_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_event_owner("budget_items"."event_id", (select auth.uid())) OR public.is_event_collaborator("budget_items"."event_id", (select auth.uid())));--> statement-breakpoint
CREATE POLICY "budget_items_insert_owner_or_editor" ON "budget_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_event_owner("budget_items"."event_id", (select auth.uid())) OR public.is_event_collaborator("budget_items"."event_id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "budget_items_update_owner_or_editor" ON "budget_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_event_owner("budget_items"."event_id", (select auth.uid())) OR public.is_event_collaborator("budget_items"."event_id", (select auth.uid()), 'editor'));--> statement-breakpoint
CREATE POLICY "budget_items_delete_owner_or_editor" ON "budget_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_event_owner("budget_items"."event_id", (select auth.uid())) OR public.is_event_collaborator("budget_items"."event_id", (select auth.uid()), 'editor'));