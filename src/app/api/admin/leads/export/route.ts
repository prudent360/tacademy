import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { curriculumRequests } from "@/db/schema";
import { getCurrentUser, can } from "@/lib/auth";

function csv(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  // Quote everything and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
}

/** CSV of every curriculum request, newest first. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await can(user, "leads.view"))) return new Response("Unauthorized", { status: 401 });
  const rows = await (await getDb()).select().from(curriculumRequests).orderBy(desc(curriculumRequests.createdAt));
  const header = ["Date", "Name", "Email", "Phone", "Course"];
  const lines = rows.map((r) => [r.createdAt.toISOString(), r.name, r.email, r.phone, r.courseTitle].map(csv).join(","));
  return new Response([header.map(csv).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="curriculum-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
