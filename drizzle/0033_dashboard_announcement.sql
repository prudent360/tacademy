ALTER TABLE "settings" ADD COLUMN "announcement" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "announcement_seen" text;