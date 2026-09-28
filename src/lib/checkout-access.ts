import "server-only";
import { cookies } from "next/headers";
import type { Payment } from "@/db/schema";
import { getCurrentUser } from "./auth";

const COOKIE = "academy_checkout";

/**
 * People enrolling without an account can't sign in until they've paid, so the browser that
 * started a checkout remembers its reference to open the return, transfer and test pages.
 */
export async function rememberCheckout(reference: string): Promise<void> {
  (await cookies()).set(COOKIE, reference, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/checkout",
    maxAge: 7 * 24 * 60 * 60,
  });
}

/** True for the signed-in owner of the payment, or the browser that started its checkout. */
export async function canViewPayment(payment: Pick<Payment, "userId" | "reference">): Promise<{ allowed: boolean; signedIn: boolean }> {
  const user = await getCurrentUser();
  if (user?.id === payment.userId) return { allowed: true, signedIn: true };
  return { allowed: (await cookies()).get(COOKIE)?.value === payment.reference, signedIn: false };
}
