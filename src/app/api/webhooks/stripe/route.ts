import Stripe from "stripe";
import { gatewayConfig } from "@/lib/config";
import { fulfilPayment } from "@/lib/payments";

/**
 * Stripe webhook (checkout.session.completed / async_payment_succeeded).
 * Endpoint: /api/webhooks/stripe. The signing secret comes from Settings > Payments (or STRIPE_WEBHOOK_SECRET).
 */
export async function POST(request: Request) {
  const cfg = await gatewayConfig("stripe");
  const secret = cfg.webhookSecret;
  const key = cfg.secretKey;
  if (!secret || !key) return new Response("Stripe is not configured", { status: 503 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await new Stripe(key).webhooks.constructEventAsync(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const reference = session.client_reference_id ?? session.metadata?.reference;
    if (reference && session.payment_status === "paid") await fulfilPayment(reference);
  }
  return Response.json({ received: true });
}
