import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { gatewayConfig } from "@/lib/config";
import { verifyPayment } from "@/lib/payments";

/**
 * TransactPay webhook. Endpoint: /api/webhooks/transactpay (set under Settings → API Keys & Webhooks).
 * TransactPay doesn't sign its webhooks, so the body is only used to find the payment: verifyPayment asks
 * TransactPay's API for the real status, and a forged webhook can't mark anything paid.
 */
export async function POST(request: Request) {
  if (!(await gatewayConfig("transactpay")).secretKey) return new Response("TransactPay is not configured", { status: 503 });

  const body = (await request.json().catch(() => null)) as { data?: { orderReference?: string }; orderReference?: string } | null;
  const reference = body?.data?.orderReference ?? body?.orderReference;
  if (reference) {
    const [payment] = await (await getDb()).select({ reference: payments.reference }).from(payments).where(and(eq(payments.gateway, "transactpay"), eq(payments.reference, String(reference))));
    if (payment) await verifyPayment(payment.reference);
  }
  return Response.json({ received: true });
}
