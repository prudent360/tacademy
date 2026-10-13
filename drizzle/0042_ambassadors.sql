CREATE TABLE "ambassadors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"channels" text DEFAULT '' NOT NULL,
	"motivation" text DEFAULT '' NOT NULL,
	"percent" integer,
	"discount_code_id" integer,
	"admin_notes" text DEFAULT '' NOT NULL,
	"decided_by_id" integer,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ambassadors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "discount_codes" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "referral_commissions" ADD COLUMN "source" text DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE "referral_commissions" ADD COLUMN "ambassador" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ambassadors" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ambassadors" ADD CONSTRAINT "ambassadors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ambassadors" ADD CONSTRAINT "ambassadors_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ambassadors" ADD CONSTRAINT "ambassadors_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ambassadors_status_idx" ON "ambassadors" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;