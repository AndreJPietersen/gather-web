CREATE TABLE "event_type_service_categories" (
	"event_type_id" uuid NOT NULL,
	"service_category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_type_service_categories_event_type_id_service_category_id_pk" PRIMARY KEY("event_type_id","service_category_id")
);
--> statement-breakpoint
ALTER TABLE "event_type_service_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_type_id" uuid;--> statement-breakpoint
ALTER TABLE "vendor_services" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "event_type_service_categories" ADD CONSTRAINT "event_type_service_categories_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_type_service_categories" ADD CONSTRAINT "event_type_service_categories_service_category_id_service_categories_id_fk" FOREIGN KEY ("service_category_id") REFERENCES "public"."service_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_type_service_categories_service_category_id_idx" ON "event_type_service_categories" USING btree ("service_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_types_name_unique" ON "event_types" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_name_unique" ON "service_categories" USING btree ("name");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_services" ADD CONSTRAINT "vendor_services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_event_type_id_idx" ON "events" USING btree ("event_type_id");--> statement-breakpoint
CREATE INDEX "vendor_services_category_id_idx" ON "vendor_services" USING btree ("category_id");--> statement-breakpoint
CREATE POLICY "event_type_service_categories_select_all" ON "event_type_service_categories" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "event_types_select_all" ON "event_types" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "service_categories_select_all" ON "service_categories" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);