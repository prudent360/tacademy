CREATE TABLE "curriculum_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer,
	"course_title" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "curriculum_url" text;--> statement-breakpoint
ALTER TABLE "curriculum_requests" ADD CONSTRAINT "curriculum_requests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "curriculum_requests_created_idx" ON "curriculum_requests" USING btree ("created_at");