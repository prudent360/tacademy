CREATE TABLE "programme_certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"programme_id" integer NOT NULL,
	"code" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "programme_certificates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "programme_certificates" ADD CONSTRAINT "programme_certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_certificates" ADD CONSTRAINT "programme_certificates_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "programme_certificates_user_programme_idx" ON "programme_certificates" USING btree ("user_id","programme_id");