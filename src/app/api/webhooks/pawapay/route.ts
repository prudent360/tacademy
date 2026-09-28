import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { gatewayConfig } from "@/lib/config";
import { verifyPayment } from "@/lib/payments";

/**
 * pawaPay deposit callback. Endpoint: /api/webhooks/pawapay (set under System configuration → Callback URLs).
 * The body is only used to find the payment: verifyPayment asks pawaPay's API for the real status,
 * so an unsigned or forged callback can't mark anything paid.
 */
export async function POST(request: Request) {
  if (!(await gatewayConfig("pawapay")).secretKey) return new Response("pawaPay is not configured", { status: 503 });

  const body = (await request.json().catch(() => null)) as { depositId?: string; data?: { depositId?: string } } | null;
  const depositId = body?.depositId ?? body?.data?.depositId;
  if (depositId) {
    const [payment] = await (await getDb()).select().from(payments).where(and(eq(payments.gateway, "pawapay"), eq(payments.providerId, depositId)));
    if (payment) await verifyPayment(payment.reference);
  }
  return Response.json({ received: true });
}
