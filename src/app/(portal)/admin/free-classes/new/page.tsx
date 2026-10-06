import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { FreeClassForm } from "@/components/admin/free-class-form";
import { PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "New free class" };

export default async function NewFreeClassPage() {
  await requirePermission("free_classes.manage");
  const [list, settings] = await Promise.all([(await getDb()).select({ id: courses.id, title: courses.title }).from(courses).orderBy(asc(courses.sortOrder), asc(courses.title)), getSettings()]);
  return (
    <>
      <PageHeader back={{ href: "/admin/free-classes", label: "Free classes" }} title="New free class" description="Saved as a draft until you set it to Open." />
      <FreeClassForm courses={list} timezone={settings.timezone} />
    </>
  );
}
