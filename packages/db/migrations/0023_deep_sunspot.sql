ALTER TABLE "vendors" ADD COLUMN "logo_path" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;