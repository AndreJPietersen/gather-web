CREATE TABLE "admin_watchlist_dismissals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal" text NOT NULL,
	"subject_key" text NOT NULL,
	"hits_at_dismissal" integer NOT NULL,
	"note" text,
	"dismissed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_watchlist_dismissals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_suspensions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"reason" text,
	"suspended_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_suspensions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_watchlist_dismissals" ADD CONSTRAINT "admin_watchlist_dismissals_dismissed_by_profiles_id_fk" FOREIGN KEY ("dismissed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_suspensions" ADD CONSTRAINT "user_suspensions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_suspensions" ADD CONSTRAINT "user_suspensions_suspended_by_profiles_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_watchlist_dismissals_subject_unique" ON "admin_watchlist_dismissals" USING btree ("signal","subject_key");--> statement-breakpoint
ALTER POLICY "vendors_select_public_or_own" ON "vendors" TO anon,authenticated USING (("vendors"."verification_status" IN ('verified', 'unclaimed', 'claim_pending') AND "vendors"."hidden_at" IS NULL) OR "vendors"."created_by" = (select auth.uid()) OR public.is_vendor_team_member("vendors"."id", (select auth.uid())));