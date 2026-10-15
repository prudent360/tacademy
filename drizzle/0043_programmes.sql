CREATE TABLE "programme_courses" (
	"programme_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "programme_courses_programme_id_course_id_pk" PRIMARY KEY("programme_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "programmes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"level" text DEFAULT 'Beginner' NOT NULL,
	"duration" text DEFAULT '' NOT NULL,
	"prices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fee_note" text DEFAULT '' NOT NULL,
	"outcomes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"job_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_url" text,
	"hero_image_url" text,
	"seo_title" text DEFAULT '' NOT NULL,
	"seo_description" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programmes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "programme_courses" ADD CONSTRAINT "programme_courses_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_courses" ADD CONSTRAINT "programme_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "programme_courses_course_idx" ON "programme_courses" USING btree ("course_id");