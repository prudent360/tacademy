ALTER TABLE "course_modules" ALTER COLUMN "published" SET DEFAULT true;--> statement-breakpoint
-- Publishing moves to lessons only. Lessons in draft modules become drafts so nothing new becomes visible.
UPDATE "lessons" SET "published" = false WHERE "module_id" IN (SELECT "id" FROM "course_modules" WHERE "published" = false);--> statement-breakpoint
UPDATE "course_modules" SET "published" = true WHERE "published" = false;
