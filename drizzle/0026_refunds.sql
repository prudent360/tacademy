ALTER TABLE "payments" ADD COLUMN "refunded_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_by_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_by_id_users_id_fk" FOREIGN KEY ("refunded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;