CREATE TABLE "internship_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"country" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"graduate_claimed" boolean DEFAULT false NOT NULL,
	"graduate_verified" boolean DEFAULT false NOT NULL,
	"qualification" text DEFAULT '' NOT NULL,
	"current_status" text DEFAULT '' NOT NULL,
	"skill_area" text DEFAULT '' NOT NULL,
	"experience" text DEFAULT '' NOT NULL,
	"preferred_cohort_id" integer,
	"mode" text DEFAULT 'either' NOT NULL,
	"hours_per_week" text DEFAULT '' NOT NULL,
	"has_laptop" boolean DEFAULT false NOT NULL,
	"has_internet" boolean DEFAULT false NOT NULL,
	"portfolio_url" text,
	"linkedin_url" text,
	"cv_url" text,
	"motivation" text DEFAULT '' NOT NULL,
	"heard_from" text DEFAULT '' NOT NULL,
	"is_adult" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"admin_notes" text DEFAULT '' NOT NULL,
	"accepted_cohort_id" integer,
	"decided_by_id" integer,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_preferred_cohort_id_cohorts_id_fk" FOREIGN KEY ("preferred_cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_accepted_cohort_id_cohorts_id_fk" FOREIGN KEY ("accepted_cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "internship_applications_status_idx" ON "internship_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "internship_applications_email_idx" ON "internship_applications" USING btree ("email");