ALTER TABLE "email_log" ADD COLUMN "text" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "email_log_status_idx" ON "email_log" USING btree ("status","id");--> statement-breakpoint
CREATE INDEX "email_log_to_idx" ON "email_log" USING btree ("to","template");