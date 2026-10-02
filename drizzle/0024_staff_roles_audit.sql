CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_role_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_staff_role_key_staff_roles_key_fk" FOREIGN KEY ("staff_role_key") REFERENCES "public"."staff_roles"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Starter roles; admins can change what they can do or delete them under Team & roles.
INSERT INTO "staff_roles" ("key", "name", "description", "permissions") VALUES
  ('admissions', 'Admissions officer', 'Handles applications, enrolments and student questions', '["admin.access","users.view","users.manage","applications.review","instructors.review","leads.view","payments.view"]'::jsonb),
  ('finance', 'Finance', 'Payments, refunds, discount codes and revenue reports', '["admin.access","payments.view","payments.manage","discounts.manage","reports.view","users.view"]'::jsonb),
  ('content', 'Content manager', 'Courses, cohorts, curriculum, certificates and reviews', '["admin.access","courses.manage","certificates.manage","reviews.manage","insights.view","users.view"]'::jsonb),
  ('support', 'Student support', 'Looks up students and their progress', '["admin.access","users.view","insights.view","payments.view"]'::jsonb)
ON CONFLICT ("key") DO NOTHING;
