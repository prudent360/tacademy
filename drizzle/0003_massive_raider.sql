CREATE TABLE "discount_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"percent_off" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "cohorts" ADD COLUMN "deposit_percent" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "curriculum" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "portfolio_projects" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "job_roles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "certificate_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "certificate_min_attendance" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "certificate_min_assignments" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "certificate_min_score" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "original_amount" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_plan" text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "discount_code_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE set null ON UPDATE no action;