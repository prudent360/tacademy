ALTER TABLE "curriculum_requests" ADD COLUMN "background" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_requests" ADD COLUMN "marketing_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_requests" ADD COLUMN "source" text DEFAULT '' NOT NULL;