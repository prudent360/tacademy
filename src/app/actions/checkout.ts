"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { fulfilPayment, testPaymentsAllowed } from "@/lib/payments";

/** Local development only: completes a simulated payment. */
export async function completeTestPayment(reference: string): Promise<void> {
  if (!testPaymentsAllowed()) throw new Error("Test payments are disabled.");
  const user = await requireUser();
  const [payment] = await (await getDb()).select().from(payments).where(and(eq(payments.reference, reference), eq(payments.userId, user.id), eq(payments.gateway, "test")));
  if (!payment) redirect("/dashboard");
  await fulfilPayment(reference);
  redirect(`/checkout/return?ref=${reference}`);
}
