CREATE TABLE "vendor_review_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_review_id" uuid NOT NULL,
	"reply_text" text NOT NULL,
	"replied_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_review_replies_vendor_review_id_unique" UNIQUE("vendor_review_id")
);
--> statement-breakpoint
ALTER TABLE "vendor_review_replies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_vendor_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"review_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_reviews_rating_range" CHECK ("vendor_reviews"."rating" >= 1 AND "vendor_reviews"."rating" <= 5)
);
--> statement-breakpoint
ALTER TABLE "vendor_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendor_review_replies" ADD CONSTRAINT "vendor_review_replies_vendor_review_id_vendor_reviews_id_fk" FOREIGN KEY ("vendor_review_id") REFERENCES "public"."vendor_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_review_replies" ADD CONSTRAINT "vendor_review_replies_replied_by_profiles_id_fk" FOREIGN KEY ("replied_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_event_vendor_id_event_vendors_id_fk" FOREIGN KEY ("event_vendor_id") REFERENCES "public"."event_vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_reviews" ADD CONSTRAINT "vendor_reviews_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_reviews_event_vendor_id_idx" ON "vendor_reviews" USING btree ("event_vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_reviews_one_per_booking_reviewer" ON "vendor_reviews" USING btree ("event_vendor_id","reviewer_id");--> statement-breakpoint
CREATE POLICY "vendor_review_replies_select_public" ON "vendor_review_replies" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "vendor_review_replies_insert_vendor_manager" ON "vendor_review_replies" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("vendor_review_replies"."replied_by" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM vendor_reviews vr JOIN event_vendors ev ON ev.id = vr.event_vendor_id
        WHERE vr.id = "vendor_review_replies"."vendor_review_id" AND public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
      ));--> statement-breakpoint
CREATE POLICY "vendor_review_replies_update_vendor_manager" ON "vendor_review_replies" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM vendor_reviews vr JOIN event_vendors ev ON ev.id = vr.event_vendor_id
        WHERE vr.id = "vendor_review_replies"."vendor_review_id" AND public.is_vendor_team_member(ev.vendor_id, (select auth.uid()), ARRAY['owner', 'manager'])
      ));--> statement-breakpoint
CREATE POLICY "vendor_reviews_select_public" ON "vendor_reviews" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "vendor_reviews_insert_self" ON "vendor_reviews" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("vendor_reviews"."reviewer_id" = (select auth.uid()) AND EXISTS (
        SELECT 1 FROM event_vendors ev WHERE ev.id = "vendor_reviews"."event_vendor_id" AND ev.status = 'contracted' AND (
          public.is_event_owner(ev.event_id, (select auth.uid())) OR public.is_event_collaborator(ev.event_id, (select auth.uid()))
        )
      ));--> statement-breakpoint
CREATE POLICY "vendor_reviews_update_own" ON "vendor_reviews" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("vendor_reviews"."reviewer_id" = (select auth.uid()));