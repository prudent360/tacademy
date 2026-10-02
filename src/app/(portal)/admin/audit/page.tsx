import type { Metadata } from "next";
import { and, count, desc, eq, ilike, like, or, type SQL } from "drizzle-orm";
import { ClipboardIcon } from "@/components/icons";
import { Badge, DataTable, EmptyState, PageHeader, Pagination, TableToolbar } from "@/components/ui";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { formatDateTime, relativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

/** Areas to filter by: the first part of each action ("payment.confirmed" is in Payments). */
const AREAS = [
  { key: "payment", label: "Payments" },
  { key: "refund", label: "Refunds" },
  { key: "discount", label: "Discounts" },
  { key: "enrolment", label: "Enrolments" },
  { key: "certificate", label: "Certificates" },
  { key: "course", label: "Courses" },
  { key: "cohort", label: "Cohorts" },
  { key: "team", label: "Team" },
  { key: "role", label: "Roles" },
  { key: "user", label: "People" },
  { key: "settings", label: "Settings" },
  { key: "application", label: "Internship applications" },
  { key: "instructor_application", label: "Instructor applications" },
] as const;

const TONE: Record<string, "accent" | "cyan" | "green" | "amber" | "red" | "navy" | "neutral"> = {
  payment: "green", refund: "red", enrolment: "cyan", certificate: "accent", course: "navy", cohort: "navy", team: "amber", role: "amber", user: "cyan", settings: "neutral", discount: "green",
};

type Search = { area?: string; q?: string; page?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("audit.view");
  const params = await searchParams;
  const area = AREAS.find((a) => a.key === params.area)?.key;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const filters: SQL[] = [];
  if (area) filters.push(like(auditLogs.action, `${area}.%`));
  if (q) filters.push(or(ilike(auditLogs.summary, `%${q}%`), ilike(auditLogs.actorName, `%${q}%`), eq(auditLogs.targetId, q))!);
  const where = filters.length ? and(...filters) : undefined;
  const db = await getDb();
  const [rows, [{ n: total }], { timezone }] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(auditLogs).where(where),
    getSettings(),
  ]);
  const url = (next: Partial<Search>) => {
    const merged = { area, q: q || undefined, page: undefined as string | undefined, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };

  return (
    <>
      <PageHeader title="Audit log" description="Everything team members have done in the admin area, newest first: payments confirmed, enrolments, certificates, course and price changes, team access and settings." />
      <TableToolbar
        action="/admin/audit"
        q={q}
        placeholder="Search by person, payment reference or description…"
        hidden={{ area }}
        filters={[{ label: "Everything", href: url({ area: undefined }), active: !area }, ...AREAS.map((a) => ({ label: a.label, href: url({ area: a.key }), active: area === a.key }))]}
      />
      {rows.length ? (
        <>
          <DataTable>
            <thead><tr><th>When</th><th>Who</th><th>What happened</th><th>From</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const kind = row.action.split(".")[0];
                return (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap"><span className="block text-sm font-semibold text-ink">{relativeTime(row.createdAt)}</span><span className="block text-xs text-muted">{formatDateTime(row.createdAt, timezone, { zone: false })}</span></td>
                    <td className="whitespace-nowrap font-semibold text-ink">{row.actorName || "System"}</td>
                    <td><span className="flex flex-wrap items-center gap-2"><Badge tone={TONE[kind] ?? "neutral"}>{kind}</Badge><span className="text-[15px] text-body">{row.actorName ? `${row.actorName.split(" ")[0]} ` : ""}{row.summary}</span></span></td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">{row.ip ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
          <Pagination page={page} pages={Math.ceil(total / PAGE_SIZE)} href={(n) => url({ page: String(n) })} />
        </>
      ) : (
        <EmptyState icon={ClipboardIcon} title={q || area ? "Nothing matches" : "Nothing recorded yet"}>{q || area ? "Try a different search or area." : "Actions taken in the admin area will appear here."}</EmptyState>
      )}
    </>
  );
}
