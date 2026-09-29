CREATE TABLE "internship_courses" (
	"internship_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	CONSTRAINT "internship_courses_internship_id_course_id_pk" PRIMARY KEY("internship_id","course_id")
);
--> statement-breakpoint
ALTER TABLE "internship_courses" ADD CONSTRAINT "internship_courses_internship_id_courses_id_fk" FOREIGN KEY ("internship_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internship_courses" ADD CONSTRAINT "internship_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;