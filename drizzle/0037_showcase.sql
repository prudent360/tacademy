CREATE TABLE "showcase_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"submission_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"course_id" integer,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"link_url" text,
	"image_url" text,
	"status" text DEFAULT 'invited' NOT NULL,
	"invite_note" text DEFAULT '' NOT NULL,
	"invited_by_id" integer,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "showcase_projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "showcase_projects_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
ALTER TABLE "showcase_projects" ADD CONSTRAINT "showcase_projects_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showcase_projects" ADD CONSTRAINT "showcase_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showcase_projects" ADD CONSTRAINT "showcase_projects_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showcase_projects" ADD CONSTRAINT "showcase_projects_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "showcase_projects_status_idx" ON "showcase_projects" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "showcase_projects_user_idx" ON "showcase_projects" USING btree ("user_id");