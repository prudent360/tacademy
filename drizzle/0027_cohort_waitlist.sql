CREATE TABLE "cohort_waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"cohort_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"offered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cohort_waitlist" ADD CONSTRAINT "cohort_waitlist_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cohort_waitlist_cohort_email_idx" ON "cohort_waitlist" USING btree ("cohort_id","email");--> statement-breakpoint
CREATE INDEX "cohort_waitlist_queue_idx" ON "cohort_waitlist" USING btree ("cohort_id","status","created_at");