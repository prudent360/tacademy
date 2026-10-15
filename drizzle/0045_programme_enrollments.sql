CREATE TABLE "programme_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"programme_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"currency" text NOT NULL,
	"total" integer NOT NULL,
	"instalment_count" integer DEFAULT 1 NOT NULL,
	"first_amount" integer NOT NULL,
	"rest_amount" integer DEFAULT 0 NOT NULL,
	"first_cohort_id" integer,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "programme_id" integer;--> statement-breakpoint
ALTER TABLE "programme_enrollments" ADD CONSTRAINT "programme_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_enrollments" ADD CONSTRAINT "programme_enrollments_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_enrollments" ADD CONSTRAINT "programme_enrollments_first_cohort_id_cohorts_id_fk" FOREIGN KEY ("first_cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "programme_enrollments_user_programme_idx" ON "programme_enrollments" USING btree ("user_id","programme_id");--> statement-breakpoint
CREATE INDEX "programme_enrollments_programme_idx" ON "programme_enrollments" USING btree ("programme_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;