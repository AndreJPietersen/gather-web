CREATE TYPE "public"."email_category" AS ENUM('transactional', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."email_recipient_status" AS ENUM('sent', 'failed', 'skipped_unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."email_template_kind" AS ENUM('system', 'custom');--> statement-breakpoint
CREATE TABLE "admin_email_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"status" "email_recipient_status" NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "admin_email_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"subject" text NOT NULL,
	"category" "email_category" NOT NULL,
	"audience" jsonb NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"sent_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_emails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_suppressions" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" text DEFAULT 'unsubscribed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_suppressions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text,
	"name" text NOT NULL,
	"kind" "email_template_kind" DEFAULT 'custom' NOT NULL,
	"category" "email_category" DEFAULT 'transactional' NOT NULL,
	"subject" text NOT NULL,
	"preheader" text,
	"heading" text,
	"body" text,
	"button_label" text,
	"button_url" text,
	"use_raw_html" boolean DEFAULT false NOT NULL,
	"raw_html" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "max_email_recipients" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_email_recipients" ADD CONSTRAINT "admin_email_recipients_email_id_admin_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."admin_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_email_recipients" ADD CONSTRAINT "admin_email_recipients_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_emails" ADD CONSTRAINT "admin_emails_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_emails" ADD CONSTRAINT "admin_emails_sent_by_profiles_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_email_recipients_email_id_idx" ON "admin_email_recipients" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "admin_emails_created_at_idx" ON "admin_emails" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_templates_key_unique" ON "email_templates" USING btree ("key");