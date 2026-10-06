CREATE TABLE "whatsapp_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"params" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "whatsapp" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "whatsapp_log_created_idx" ON "whatsapp_log" USING btree ("created_at");