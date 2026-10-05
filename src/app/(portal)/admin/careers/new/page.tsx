import type { Metadata } from "next";
import { JobForm } from "@/components/admin/job-form";
import { PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { jobOpenings } from "@/db/schema";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "New role" };

export default async function NewJobPage() {
  await requirePermission("careers.manage");
  const departments = (await (await getDb()).selectDistinct({ d: jobOpenings.department }).from(jobOpenings)).map((r) => r.d).filter(Boolean);
  return (
    <>
      <PageHeader back={{ href: "/admin/careers", label: "Careers" }} title="New role" description="Saved as a draft until you set it to Open." />
      <JobForm departments={departments} />
    </>
  );
}
