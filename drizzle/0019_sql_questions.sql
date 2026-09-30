CREATE TABLE "sql_datasets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"setup_sql" text NOT NULL,
	"tables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "sql_answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD COLUMN "sql_correct" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "dataset_id" integer;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "starter_sql" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "solution_sql" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "expected" jsonb;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "order_matters" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sql_datasets" ADD CONSTRAINT "sql_datasets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_dataset_id_sql_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."sql_datasets"("id") ON DELETE restrict ON UPDATE no action;