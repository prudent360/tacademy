import { sendDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Sends class and deadline reminders. Protected by CRON_SECRET: Vercel Cron sends it as
 * "Authorization: Bearer <secret>" automatically; external schedulers must send the same header.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET is not set", { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const result = await sendDueReminders();
  return Response.json({ ok: true, ...result });
}
