"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { canViewPayment } from "@/lib/checkout-access";
import { fulfilPayment, testPaymentsAllowed } from "@/lib/payments";

/** Local development only: completes a simulated payment. */
export async function completeTestPayment(reference: string): Promise<void> {
  if (!testPaymentsAllowed()) throw new Error("Test payments are disabled.");
  const [payment] = await (await getDb()).select().from(payments).where(and(eq(payments.reference, reference), eq(payments.gateway, "test")));
  if (!payment || !(await canViewPayment(payment)).allowed) redirect("/courses");
  await fulfilPayment(reference);
  redirect(`/checkout/return?ref=${reference}`);
}
