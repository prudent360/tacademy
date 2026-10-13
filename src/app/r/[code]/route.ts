import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { linkEarns, REF_COOKIE, referralConfig } from "@/lib/referrals";

/**
 * A referral link: /r/CODE, optionally ?to=/courses/some-course. Remembers the referrer in a cookie for the
 * configured number of days (the latest link visited wins), counts the visit, then goes to the page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? "/";
  // Only paths on this site, never another domain.
  const destination = new URL(/^\/(?!\/)/.test(to) && !to.includes("\\") ? to : "/", url.origin);
  const response = NextResponse.redirect(destination);
  const code = (await params).code.trim().toUpperCase().slice(0, 20);
  const cfg = await referralConfig();
  if (!/^[A-Z0-9]{4,20}$/.test(code)) return response;
  const db = await getDb();
  const [referrer] = await db.select({ id: users.id }).from(users).where(and(eq(users.referralCode, code), eq(users.active, true)));
  // Links count while Refer & earn is on, and always for active ambassadors.
  if (referrer && (await linkEarns(referrer.id))) {
    await db.update(users).set({ referralClicks: sql`${users.referralClicks} + 1` }).where(eq(users.id, referrer.id));
    response.cookies.set(REF_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: cfg.cookieDays * 86_400 });
  }
  return response;
}
