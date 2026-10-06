import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { emailLog } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { formatDateTime } from "@/lib/time";
import { idParam } from "@/lib/validation";
import { requirePermission } from "@/lib/auth";

export const metadata: Metadata = { title: "Email" };

export default async function EmailLogPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("emails.manage");
  const id = idParam((await params).id);
  if (!id) notFound();
  const [row] = await (await getDb()).select().from(emailLog).where(eq(emailLog.id, id));
  if (!row) notFound();
  const settings = await getSettings();
  return (
    <>
      <PageHeader back={{ href: "/admin/settings?tab=messages#email", label: "Email settings" }} title={row.subject} description={<span className="flex flex-wrap items-center gap-2">To {row.to} · {formatDateTime(row.createdAt, settings.timezone)} <StatusBadge status={row.status} label={row.status === "logged" ? "Logged only" : undefined} /></span>} />
      {row.error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{row.error}</p>}
      <Card padded={false}>
        {/* Links stay clickable for testing flows locally, e.g. verification and password links. */}
        <iframe title="Email content" srcDoc={row.html.replace("<head>", '<head><base target="_blank">')} sandbox="allow-popups allow-popups-to-escape-sandbox" className="h-[720px] w-full rounded-[14px]" />
      </Card>
    </>
  );
}
