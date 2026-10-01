CREATE TABLE "instructor_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"country" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"current_role" text DEFAULT '' NOT NULL,
	"expertise" text DEFAULT '' NOT NULL,
	"years_experience" text DEFAULT '' NOT NULL,
	"teaching_experience" text DEFAULT '' NOT NULL,
	"mode" text DEFAULT 'either' NOT NULL,
	"availability" text DEFAULT '' NOT NULL,
	"topics" text DEFAULT '' NOT NULL,
	"linkedin_url" text,
	"portfolio_url" text,
	"cv_url" text,
	"heard_from" text DEFAULT '' NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"admin_notes" text DEFAULT '' NOT NULL,
	"user_id" integer,
	"decided_by_id" integer,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instructor_applications" ADD CONSTRAINT "instructor_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_applications" ADD CONSTRAINT "instructor_applications_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "instructor_applications_status_idx" ON "instructor_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "instructor_applications_email_idx" ON "instructor_applications" USING btree ("email");