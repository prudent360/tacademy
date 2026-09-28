CREATE TABLE "module_releases" (
	"cohort_id" integer NOT NULL,
	"module_id" integer NOT NULL,
	"release_at" timestamp with time zone NOT NULL,
	CONSTRAINT "module_releases_cohort_id_module_id_pk" PRIMARY KEY("cohort_id","module_id")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "lesson_id" integer;--> statement-breakpoint
ALTER TABLE "module_releases" ADD CONSTRAINT "module_releases_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_releases" ADD CONSTRAINT "module_releases_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "module_releases_cohort_idx" ON "module_releases" USING btree ("cohort_id","release_at");--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;