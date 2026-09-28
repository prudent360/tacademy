ALTER TABLE "cohorts" ADD COLUMN "graduates_free" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "kind" text DEFAULT 'course' NOT NULL;