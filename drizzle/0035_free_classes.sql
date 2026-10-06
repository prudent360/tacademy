CREATE TABLE "free_class_signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"background" text DEFAULT '' NOT NULL,
	"heard_from" text DEFAULT '' NOT NULL,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"attended" boolean,
	"discount_code_id" integer,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "free_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"takeaways" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"course_id" integer,
	"host_name" text DEFAULT '' NOT NULL,
	"host_title" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"mode" text DEFAULT 'virtual' NOT NULL,
	"meeting_url" text,
	"venue" text DEFAULT '' NOT NULL,
	"capacity" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"offer_percent" integer DEFAULT 10 NOT NULL,
	"offer_days" integer DEFAULT 7 NOT NULL,
	"recording_url" text,
	"reminder_day_sent_at" timestamp with time zone,
	"reminder_hour_sent_at" timestamp with time zone,
	"follow_up_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "free_classes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "free_class_signups" ADD CONSTRAINT "free_class_signups_class_id_free_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."free_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_class_signups" ADD CONSTRAINT "free_class_signups_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_classes" ADD CONSTRAINT "free_classes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "free_class_signups_email_idx" ON "free_class_signups" USING btree ("class_id","email");--> statement-breakpoint
CREATE INDEX "free_class_signups_created_idx" ON "free_class_signups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "free_classes_status_idx" ON "free_classes" USING btree ("status","starts_at");