import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { addSampleDatasets } from "@/app/actions/sql";
import { ActionButton } from "@/components/forms";
import { DatabaseIcon, PlusIcon } from "@/components/icons";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { quizQuestions, sqlDatasets, users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { SAMPLE_DATASETS } from "@/lib/sql-samples";

export const metadata: Metadata = { title: "SQL datasets" };

/** The library of practice data that SQL questions run against. */
export default async function DatasetsPage() {
  await requireRole("admin", "instructor");
  const db = await getDb();
  const [list, uses] = await Promise.all([
    db.select({ id: sqlDatasets.id, name: sqlDatasets.name, description: sqlDatasets.description, tables: sqlDatasets.tables, author: users.name }).from(sqlDatasets).leftJoin(users, eq(users.id, sqlDatasets.createdById)).orderBy(asc(sqlDatasets.name)),
    db.select({ datasetId: quizQuestions.datasetId, n: count() }).from(quizQuestions).groupBy(quizQuestions.datasetId),
  ]);
  const missingSamples = SAMPLE_DATASETS.filter((s) => !list.some((d) => d.name === s.name)).length;

  return (
    <>
      <PageHeader
        title="SQL datasets"
        description="Practice data for SQL questions. Students query it in their browser; it's never changed by their queries."
        actions={<Link href="/teach/datasets/new" className={buttonClass.primary}><PlusIcon className="size-4" /> New dataset</Link>}
      />
      {missingSamples > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-body">Start with our ready-made datasets: an online shop (customers, products, orders) and a company&apos;s staff (departments, employees).</p>
            <ActionButton action={addSampleDatasets} variant="primary" pendingText="Adding…">Add sample datasets</ActionButton>
          </div>
        </Card>
      )}
      {list.length ? (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {list.map((d) => {
              const used = uses.find((u) => u.datasetId === d.id)?.n ?? 0;
              return (
                <li key={d.id}>
                  <Link href={`/teach/datasets/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-panel md:px-6">
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="font-semibold text-ink">{d.name}</span>
                      <span className="text-sm text-muted">{d.tables.map((t) => `${t.name} (${t.rows})`).join(" · ")}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {used > 0 && <Badge tone="accent">{used} question{used === 1 ? "" : "s"}</Badge>}
                      {d.author && <span className="text-xs text-muted">by {d.author}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : !missingSamples && <EmptyState icon={DatabaseIcon} title="No datasets yet">Upload CSV files or paste SQL to create one.</EmptyState>}
    </>
  );
}
