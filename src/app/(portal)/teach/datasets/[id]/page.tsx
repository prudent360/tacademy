import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteDataset, updateDataset } from "@/app/actions/sql";
import { DeleteButton } from "@/components/forms";
import { DatasetForm } from "@/components/sql/dataset-form";
import { Card, Notice, PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { quizQuestions, sqlDatasets } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { idParam } from "@/lib/validation";

export const metadata: Metadata = { title: "Dataset" };

export default async function DatasetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id: raw }, { created }] = await Promise.all([params, searchParams]);
  const id = idParam(raw);
  if (!id) notFound();
  const user = await requireRole("admin", "instructor");
  const db = await getDb();
  const [dataset] = await db.select().from(sqlDatasets).where(eq(sqlDatasets.id, id));
  if (!dataset) notFound();
  const [{ n: used }] = await db.select({ n: count() }).from(quizQuestions).where(eq(quizQuestions.datasetId, id));
  const mine = user.role === "admin" || dataset.createdById === user.id;

  return (
    <>
      <PageHeader back={{ href: "/teach/datasets", label: "SQL datasets" }} title={dataset.name} description={dataset.description || undefined} />
      {created && <Notice>Dataset created. Add a SQL question to a lesson&apos;s quiz and pick this dataset.</Notice>}
      <Card title="Tables">
        <ul className="grid gap-4 md:grid-cols-2">
          {dataset.tables.map((t) => (
            <li key={t.name} className="rounded-[8px] border border-edge">
              <p className="flex items-center justify-between border-b border-line bg-panel px-4 py-2.5 font-mono text-sm font-semibold text-ink">{t.name}<span className="font-sans text-xs font-normal text-muted">{t.rows} rows</span></p>
              <ul className="px-4 py-2 font-mono text-[13px]">{t.columns.map((c) => <li key={c.name} className="flex justify-between gap-6 py-0.5"><span className="text-ink">{c.name}</span><span className="text-muted">{c.type}</span></li>)}</ul>
            </li>
          ))}
        </ul>
      </Card>
      {mine ? (
        <Card title="Edit dataset">
          <DatasetForm
            action={updateDataset.bind(null, id)}
            dataset={{ name: dataset.name, description: dataset.description, setupSql: used ? "" : dataset.setupSql }}
            canReplaceData={!used}
            lockedReason={`${used} question${used === 1 ? " uses" : "s use"} this dataset, so its data can't change (it would change their correct answers). Create a new dataset for different data.`}
          />
        </Card>
      ) : <p className="text-sm text-muted">Only the person who added this dataset, or an admin, can change it.</p>}
      {mine && !used && <div className="flex justify-end"><DeleteButton action={deleteDataset.bind(null, id)} label="Delete dataset" /></div>}
    </>
  );
}
