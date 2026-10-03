import { NextResponse, type NextRequest } from "next/server";
import { homeFor, SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PROTECTED = ["/dashboard", "/teach", "/admin", "/account", "/notifications", "/api/upload", "/api/sessions"];
const GUEST_ONLY = ["/login", "/register"];

/**
 * Sends signed-out visitors to sign in and signed-in users away from the sign-in pages.
 * Layouts and actions still check the user and role against the database.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (GUEST_ONLY.includes(pathname)) {
    return session ? NextResponse.redirect(new URL(homeFor(session.role), request.url)) : NextResponse.next();
  }
  if (!session && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/teach/:path*", "/admin/:path*", "/account/:path*", "/notifications/:path*", "/api/upload/:path*", "/api/sessions/:path*", "/login", "/register"],
};
