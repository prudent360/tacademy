import { can, getCurrentUser } from "@/lib/auth";
import { RANGES, buildReport, type RangeKey } from "@/lib/reports";

const cell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Revenue and enrolments by course for the chosen period, one row per course and currency. Amounts in major units. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await can(user, "reports.view"))) return new Response("Unauthorized", { status: 401 });
  const raw = new URL(request.url).searchParams.get("range");
  const range: RangeKey = RANGES.find((r) => r.key === raw)?.key ?? "90d";
  const report = await buildReport(range);
  const lines = [["Course", "Type", "Enrolments", "Payments", "Currency", "Gross", "Refunds", "Net"].join(",")];
  for (const c of report.courses) {
    const currencies = [...new Set([...c.gross.keys(), ...c.refunds.keys()])];
    if (!currencies.length) lines.push([cell(c.title), c.kind, c.enrolments, c.payments, "", 0, 0, 0].join(","));
    for (const cur of currencies) lines.push([cell(c.title), c.kind, c.enrolments, c.payments, cur, ((c.gross.get(cur) ?? 0) / 100).toFixed(2), ((c.refunds.get(cur) ?? 0) / 100).toFixed(2), ((c.net.get(cur) ?? 0) / 100).toFixed(2)].join(","));
  }
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="report-${range}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
