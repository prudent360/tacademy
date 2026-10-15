import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { CapIcon } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { programmes } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { programmeCourseMap } from "@/lib/programmes";

export const metadata: Metadata = { title: "Programmes" };

export default async function AdminProgrammesPage() {
  await requirePermission("courses.manage");
  const rows = await (await getDb()).select().from(programmes).orderBy(asc(programmes.sortOrder), asc(programmes.title));
  const included = await programmeCourseMap(rows.map((r) => r.id));
  return (
    <>
      <PageHeader title="Programmes" description="Bundle courses into a programme with its own duration and fee, shown on the website under Programmes."
        actions={<Link href="/admin/programmes/new" className={buttonClass.primary}>New programme</Link>} />
      {rows.length ? (
        <DataTable>
          <thead><tr><th>Programme</th><th>Courses</th><th>Duration</th><th>Fee</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const fees = Object.entries(r.prices).filter((e): e is [string, number] => (e[1] ?? 0) > 0);
              return (
                <tr key={r.id}>
                  <td><Link href={`/admin/programmes/${r.id}`} className="font-semibold text-ink hover:text-accent-ink">{r.title}</Link><p className="text-sm text-muted">/programmes/{r.slug}</p></td>
                  <td className="text-sm text-body">{(included.get(r.id) ?? []).map((c) => c.title).join(" → ") || <span className="text-muted">None</span>}</td>
                  <td className="text-sm">{r.duration}</td>
                  <td>{fees.length ? <span className="flex flex-wrap gap-1.5"><Badge tone="accent">{fees.slice(0, 2).map(([cur, v]) => formatMoney(v, cur)).join(" / ")}</Badge>{r.instalmentCount && <Badge>{r.instalmentCount} instalments</Badge>}</span> : <span className="text-sm text-muted">Not set</span>}</td>
                  <td>{r.published ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState icon={CapIcon} title="No programmes yet" action={<Link href="/admin/programmes/new" className={buttonClass.primary}>Create your first programme</Link>}>A programme combines two or more courses into one path, with a name, duration and fee.</EmptyState>
      )}
    </>
  );
}
