import { getCurrentUser } from "@/lib/auth";
import { listPayments, parsePaymentFilters } from "@/lib/admin-payments";

const GATEWAY = { stripe: "Stripe", paystack: "Paystack", manual: "Bank transfer / offline", test: "Test" } as const;

function csv(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  // Quote everything and neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
}

/** CSV of payments matching the same filters as the Payments page. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new Response("Unauthorized", { status: 401 });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { rows } = await listPayments(parsePaymentFilters(params), { limit: 10_000, offset: 0 });
  const header = ["Date", "Paid at", "Reference", "Student", "Email", "Description", "Amount", "Currency", "Status", "Gateway"];
  const lines = rows.map(({ payment: p, user: u }) => [
    p.createdAt.toISOString(), p.paidAt?.toISOString() ?? "", p.reference, u.name, u.email, p.description, (p.amount / 100).toFixed(2), p.currency, p.status, GATEWAY[p.gateway],
  ].map(csv).join(","));
  return new Response([header.map(csv).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
