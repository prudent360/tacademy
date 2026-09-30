import type { Metadata } from "next";
import { createDataset } from "@/app/actions/sql";
import { DatasetForm } from "@/components/sql/dataset-form";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "New dataset" };

export default async function NewDatasetPage() {
  await requireRole("admin", "instructor");
  return (
    <>
      <PageHeader back={{ href: "/teach/datasets", label: "SQL datasets" }} title="New dataset" description="Upload a CSV file for each table, or paste SQL that creates and fills the tables." />
      <Card><DatasetForm action={createDataset} /></Card>
    </>
  );
}
