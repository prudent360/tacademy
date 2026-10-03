import type { Metadata } from "next";
import Link from "next/link";
import { CardIcon, ChartIcon, DownloadIcon, TrendIcon, UsersIcon, XCircleIcon } from "@/components/icons";
import { LineChart } from "@/components/portal/charts";
import { BarChart, Panel, PanelEmpty, StatTile } from "@/components/portal/dash";
import { Badge, DataTable, PageHeader, buttonClass } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { RANGES, buildReport, type RangeKey } from "@/lib/reports";
import { formatDateOnly } from "@/lib/time";

export const metadata: Metadata = { title: "Reports" };

const GATEWAY_LABEL: Record<string, string> = { stripe: "Stripe", paystack: "Paystack", transactpay: "TransactPay", manual: "Bank / offline", test: "Test" };

/** Amounts in several currencies, primary first: "£1,250 + ₦350,000". */
function moneyList(m: Map<string, number>, primary: string): string {
  const entries = [...m].filter(([, v]) => v !== 0).sort(([a], [b]) => (a === primary ? -1 : b === primary ? 1 : a.localeCompare(b)));
  return entries.length ? entries.map(([c, v]) => formatMoney(v, c)).join(" + ") : formatMoney(0, primary);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requirePermission("reports.view");
  const { range: raw } = await searchParams;
  const range: RangeKey = RANGES.find((r) => r.key === raw)?.key ?? "90d";
  const [settings, report] = await Promise.all([getSettings(), buildReport(range)]);
  const primary = settings.currencies[0] ?? "GBP";
  const conversion = report.leads ? Math.round((report.converted / report.leads) * 100) : null;
  const currencies = [...report.net.keys()];

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Revenue, enrolments and conversion since ${formatDateOnly(report.since.toISOString().slice(0, 10))}. Revenue is net of refunds and counted when payments are received.`}
        actions={<a href={`/api/admin/reports/export?range=${range}`} className={buttonClass.secondary}><DownloadIcon className="size-4" /> Export CSV</a>}
      />
      <nav aria-label="Period" className="flex flex-wrap gap-2">
        {RANGES.map((r) => <Link key={r.key} href={`/admin/reports?range=${r.key}`} className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${range === r.key ? "border-accent bg-accent text-white" : "border-edge-strong bg-surface text-body hover:border-accent hover:text-accent-ink"}`}>{r.label}</Link>)}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Net revenue" value={moneyList(new Map([[primary, report.net.get(primary) ?? 0]]), primary)} icon={TrendIcon} tone="green" hint={currencies.filter((c) => c !== primary).length ? `+ ${moneyList(new Map([...report.net].filter(([c]) => c !== primary)), primary)}` : `${report.paymentCount} payment${report.paymentCount === 1 ? "" : "s"}`} />
        <StatTile label="Refunds" value={moneyList(new Map([[primary, report.refunds.get(primary) ?? 0]]), primary)} icon={XCircleIcon} tone="red" hint={`${report.refundCount} payment${report.refundCount === 1 ? "" : "s"} refunded`} />
        <StatTile label="New enrolments" value={report.enrolments} icon={UsersIcon} tone="purple" hint={`${report.paidEnrolments} paid, ${report.enrolments - report.paidEnrolments} free or added`} />
        <StatTile label="Curriculum → enrolment" value={conversion === null ? "–" : `${conversion}%`} icon={ChartIcon} tone="cyan" hint={`${report.converted} of ${report.leads} curriculum requests`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <Panel title={`Net revenue by month (${primary})`} icon={TrendIcon}>
          {report.net.get(primary) ? <LineChart labels={report.months.map((m) => m.label)} series={[{ label: "Net revenue", color: "accent", values: report.revenueByMonth(primary).map((v) => v / 100) }]} format={(v) => formatMoney(Math.round(v * 100), primary)} /> : <PanelEmpty icon={TrendIcon}>No {primary} payments in this period.</PanelEmpty>}
        </Panel>
        <Panel title="Enrolments by month" icon={UsersIcon}>
          {report.enrolments ? <BarChart data={report.enrolmentsByMonth} tone="cyan" highlightLast={false} /> : <PanelEmpty icon={UsersIcon}>No enrolments in this period.</PanelEmpty>}
        </Panel>
      </div>

      <Panel title="By course" icon={ChartIcon} padded={false}>
        {report.courses.length ? (
          <DataTable>
            <thead><tr><th>Course</th><th className="text-right">Enrolments</th><th className="text-right">Payments</th><th className="text-right">Gross</th><th className="text-right">Refunds</th><th className="text-right">Net</th></tr></thead>
            <tbody>
              {report.courses.map((c) => (
                <tr key={c.courseId}>
                  <td><span className="font-semibold text-ink">{c.title}</span>{c.kind === "internship" && <Badge className="ml-2">Internship</Badge>}</td>
                  <td className="text-right font-semibold text-ink">{c.enrolments}</td>
                  <td className="text-right text-body">{c.payments}</td>
                  <td className="text-right text-body">{moneyList(c.gross, primary)}</td>
                  <td className="text-right text-red-700">{[...c.refunds.values()].some((v) => v) ? moneyList(c.refunds, primary) : "–"}</td>
                  <td className="text-right font-semibold text-ink">{moneyList(c.net, primary)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : <div className="p-6"><PanelEmpty icon={ChartIcon}>Nothing to report for this period yet.</PanelEmpty></div>}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <Panel title="How students paid" icon={CardIcon}>
          {report.gateways.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {report.gateways.map((g) => (
                <li key={g.gateway} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <span className="font-semibold text-ink">{GATEWAY_LABEL[g.gateway] ?? g.gateway}</span>
                  <span className="text-right"><span className="block font-semibold text-ink">{moneyList(g.net, primary)}</span><span className="text-xs text-muted">{g.count} payment{g.count === 1 ? "" : "s"}</span></span>
                </li>
              ))}
            </ul>
          ) : <PanelEmpty icon={CardIcon}>No payments in this period.</PanelEmpty>}
        </Panel>
        <Panel title="Curriculum requests to enrolments" icon={ChartIcon}>
          <div className="flex flex-col gap-4">
            {[
              { label: "Requested a curriculum", value: report.leads },
              { label: "Then enrolled", value: report.converted },
            ].map((step, i) => (
              <div key={step.label} className="flex flex-col gap-1.5">
                <span className="flex justify-between text-sm"><span className="font-semibold text-ink">{step.label}</span><span className="text-muted">{step.value}</span></span>
                <span className="h-3 overflow-hidden rounded-full bg-page"><span className="block h-full rounded-full" style={{ width: `${report.leads ? Math.max(step.value ? 4 : 0, (step.value / report.leads) * 100) : 0}%`, background: i ? "var(--color-cyan)" : "var(--color-accent)" }} /></span>
              </div>
            ))}
            <p className="text-xs text-muted">Matched by email: someone who downloaded a curriculum and later enrolled on any course.</p>
          </div>
        </Panel>
      </div>
    </>
  );
}
